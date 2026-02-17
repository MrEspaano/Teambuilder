import { useEffect, useMemo, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import BlockRulesEditor from "./components/BlockRulesEditor";
import ClassSelector from "./components/ClassSelector";
import StudentEditor from "./components/StudentEditor";
import TeamGenerator from "./components/TeamGenerator";
import type { AppData, BlockRule, Student } from "./types";
import {
  clearStoredSession,
  fetchCurrentUser,
  loginWithEmail,
  loadStoredSession,
  logoutSession,
  saveStoredSession,
  signupWithEmail
} from "./utils/authApi";
import type { AuthSession } from "./utils/authApi";
import { isCloudAuthError, loadUserAppData, saveUserAppData } from "./utils/cloudStorage";
import { normalizeName } from "./utils/normalize";
import { createClassRoom, createEmptyData, loadAppData, saveAppData } from "./utils/storage";

const GUEST_MODE_KEY = "lagbyggare:guest-mode";

const App = () => {
  const [data, setData] = useState<AppData>(createEmptyData());
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isDataReady, setIsDataReady] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const stored = loadStoredSession();
      if (!stored) {
        if (!isMounted) {
          return;
        }

        const guestEnabled = typeof localStorage !== "undefined" && localStorage.getItem(GUEST_MODE_KEY) === "1";
        if (guestEnabled) {
          setIsGuestMode(true);
          setData(loadAppData());
          setIsAuthLoading(false);
          setIsDataReady(true);
          return;
        }

        setIsGuestMode(false);
        setAuthSession(null);
        setIsAuthLoading(false);
        setIsDataReady(true);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(stored.accessToken);
        if (!currentUser || currentUser.id !== stored.userId) {
          throw new Error("Ogiltig session.");
        }

        if (!isMounted) {
          return;
        }

        const nextSession: AuthSession = {
          ...stored,
          email: currentUser.email
        };
        setIsGuestMode(false);
        setAuthSession(nextSession);
        saveStoredSession(nextSession);
        setErrorMessage(null);
      } catch {
        if (!isMounted) {
          return;
        }

        clearStoredSession();
        setIsGuestMode(false);
        setAuthSession(null);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      if (isGuestMode) {
        setData(loadAppData());
        setIsDataReady(true);
        return;
      }

      if (!authSession) {
        setData(createEmptyData());
        setIsDataReady(true);
        return;
      }

      try {
        setIsDataReady(false);
        const userData = await loadUserAppData(authSession.accessToken);
        if (!isMounted) {
          return;
        }

        setData(userData);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (isCloudAuthError(error)) {
          clearStoredSession();
          setIsGuestMode(false);
          setAuthSession(null);
          setData(createEmptyData());
          setInfoMessage("Sessionen gick ut. Logga in igen.");
          setErrorMessage(null);
          return;
        }

        setErrorMessage("Kunde inte läsa dina data från kontot.");
      } finally {
        if (isMounted) {
          setIsDataReady(true);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [authSession, isAuthLoading, isGuestMode]);

  useEffect(() => {
    if (!isDataReady) {
      return;
    }

    if (isGuestMode) {
      saveAppData(data);
      return;
    }

    if (!authSession) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSaving(true);
          await saveUserAppData(data, authSession.accessToken);
          setErrorMessage(null);
        } catch (error) {
          if (isCloudAuthError(error)) {
            clearStoredSession();
            setIsGuestMode(false);
            setAuthSession(null);
            setInfoMessage("Sessionen gick ut. Logga in igen.");
            setErrorMessage(null);
            return;
          }

          setErrorMessage("Kunde inte spara dina data i kontot.");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [data, isDataReady, authSession, isGuestMode]);

  const activeClass = useMemo(
    () => data.classes.find((classRoom) => classRoom.id === data.activeClassId) ?? null,
    [data.activeClassId, data.classes]
  );

  const createClass = (name: string): string | null => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      return "Ange ett klassnamn.";
    }

    const exists = data.classes.some((classRoom) => normalizeName(classRoom.name) === normalizeName(cleanedName));
    if (exists) {
      return "En klass med det namnet finns redan.";
    }

    const newClass = createClassRoom(cleanedName);
    setData((prev) => ({
      ...prev,
      activeClassId: newClass.id,
      classes: [...prev.classes, newClass]
    }));

    return null;
  };

  const renameClass = (classId: string, name: string): string | null => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      return "Klassnamn får inte vara tomt.";
    }

    const exists = data.classes.some(
      (classRoom) => classRoom.id !== classId && normalizeName(classRoom.name) === normalizeName(cleanedName)
    );
    if (exists) {
      return "Det finns redan en klass med det namnet.";
    }

    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              name: cleanedName
            }
          : classRoom
      )
    }));

    return null;
  };

  const deleteClass = (classId: string) => {
    setData((prev) => {
      const remaining = prev.classes.filter((classRoom) => classRoom.id !== classId);
      const activeStillExists = remaining.some((classRoom) => classRoom.id === prev.activeClassId);

      return {
        ...prev,
        classes: remaining,
        activeClassId: activeStillExists ? prev.activeClassId : (remaining[0]?.id ?? null)
      };
    });
  };

  const updateStudents = (classId: string, students: Student[]) => {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              students
            }
          : classRoom
      )
    }));
  };

  const updateBlocks = (classId: string, blocks: BlockRule[]) => {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              blocks
            }
          : classRoom
      )
    }));
  };

  const updateTogetherRules = (classId: string, togetherRules: BlockRule[]) => {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              togetherRules
            }
          : classRoom
      )
    }));
  };

  const login = async (email: string, password: string) => {
    setIsAuthLoading(true);
    setInfoMessage(null);
    setErrorMessage(null);

    try {
      const session = await loginWithEmail(email, password);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(GUEST_MODE_KEY);
      }
      setIsGuestMode(false);
      setAuthSession(session);
      saveStoredSession(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inloggning misslyckades. Kontrollera e-post och lösenord.";
      setErrorMessage(message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsAuthLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const session = await signupWithEmail(email, password);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(GUEST_MODE_KEY);
      }
      setIsGuestMode(false);
      setAuthSession(session);
      saveStoredSession(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kunde inte skapa konto. Prova en annan e-post.";
      setErrorMessage(message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const enterGuestMode = async () => {
    clearStoredSession();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(GUEST_MODE_KEY, "1");
    }

    setAuthSession(null);
    setIsGuestMode(true);
    setData(loadAppData());
    setErrorMessage(null);
    setInfoMessage("Gästläge aktivt. Data sparas lokalt på den här enheten.");
    setIsAuthLoading(false);
    setIsDataReady(true);
  };

  const logout = async () => {
    if (authSession) {
      await logoutSession(authSession.accessToken);
    }

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(GUEST_MODE_KEY);
    }

    setIsGuestMode(false);
    setAuthSession(null);
    setData(createEmptyData());
    setErrorMessage(null);
    setInfoMessage(null);
    setIsDataReady(true);
    clearStoredSession();
  };

  if (!authSession && !isGuestMode) {
    return (
      <AuthPanel
        loading={isAuthLoading}
        errorMessage={errorMessage}
        infoMessage={infoMessage}
        onLogin={login}
        onRegister={register}
        onGuestLogin={enterGuestMode}
      />
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Lagbyggare för idrott</h1>
        <p>
          Skapa klasser, hantera elevlistor och generera slumpade lag med blockeringar.
          {isGuestMode ? " Gästläge." : ` Inloggad som ${authSession?.email}.`}
        </p>
        <div className="button-row">
          <button type="button" className="ghost" onClick={logout}>
            {isGuestMode ? "Avsluta gästläge" : "Logga ut"}
          </button>
          <span className="muted">
            {isGuestMode ? "Lokal lagring på enheten" : isSaving ? "Sparar i konto..." : "Synkat med konto"}
          </span>
        </div>
      </header>

      {errorMessage && <p className="message error">{errorMessage}</p>}

      <div className="app-shell">
        <aside className="panel sidebar">
          <ClassSelector
            classes={data.classes}
            activeClassId={data.activeClassId}
            onSelect={(classId) => setData((prev) => ({ ...prev, activeClassId: classId }))}
            onCreate={createClass}
            onRename={renameClass}
            onDelete={deleteClass}
          />
        </aside>

        <main className="main-stack">
          <div className="panel">
            <StudentEditor classData={activeClass} onStudentsChange={updateStudents} />
          </div>
          <div className="panel">
            <BlockRulesEditor
              classData={activeClass}
              onBlocksChange={updateBlocks}
              onTogetherRulesChange={updateTogetherRules}
            />
          </div>
          <div className="panel">
            <TeamGenerator classData={activeClass} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
