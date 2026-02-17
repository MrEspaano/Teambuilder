import { useEffect, useMemo, useState } from "react";
import AuthPanel from "./components/AuthPanel";
import BlockRulesEditor from "./components/BlockRulesEditor";
import ClassSelector from "./components/ClassSelector";
import StudentEditor from "./components/StudentEditor";
import TeamGenerator from "./components/TeamGenerator";
import type { AppData, BlockRule } from "./types";
import { isSupabaseConfigured } from "./lib/supabase";
import {
  clearStoredSession,
  loginWithEmail,
  loadStoredSession,
  logoutSession,
  saveStoredSession,
  signupWithEmail
} from "./utils/authApi";
import { normalizeName } from "./utils/normalize";
import { loadUserAppData, saveUserAppData } from "./utils/cloudStorage";
import { createClassRoom, createEmptyData, loadAppData, saveAppData } from "./utils/storage";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const App = () => {
  const [data, setData] = useState<AppData>(createEmptyData());
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [isDataReady, setIsDataReady] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setData(loadAppData());
      setIsDataReady(true);
      setIsAuthLoading(false);
      return;
    }

    const stored = loadStoredSession();
    if (!stored) {
      setIsAuthLoading(false);
      setIsDataReady(true);
      return;
    }

    setAuthSession({
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken
    });
    setUser({
      id: stored.userId,
      email: stored.email
    });
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      if (!authSession || !user) {
        setData(createEmptyData());
        setIsDataReady(true);
        return;
      }

      try {
        setIsDataReady(false);
        const userData = await loadUserAppData(user.id, authSession.accessToken);
        if (!isMounted) {
          return;
        }

        setData(userData);
        setErrorMessage(null);
        setInfoMessage(null);
      } catch {
        if (!isMounted) {
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
  }, [authSession?.accessToken, user?.id]);

  useEffect(() => {
    if (!isDataReady) {
      return;
    }

    if (!isSupabaseConfigured || !authSession || !user) {
      saveAppData(data);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSaving(true);
          await saveUserAppData(user.id, data, authSession.accessToken);
          setErrorMessage(null);
          setInfoMessage(null);
        } catch {
          setErrorMessage("Kunde inte spara dina data i kontot.");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [data, isDataReady, authSession?.accessToken, user?.id]);

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

  const updateStudents = (classId: string, students: string[]) => {
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

  const login = async (email: string, password: string) => {
    setIsAuthLoading(true);
    setInfoMessage(null);

    try {
      const session = await loginWithEmail(email, password);
      setAuthSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken
      });
      setUser({
        id: session.userId,
        email: session.email
      });
      saveStoredSession(session);
      setErrorMessage(null);
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
      if (!session) {
        setInfoMessage("Kontot skapades. Om inloggning inte sker direkt behöver mailverifiering stängas av i Supabase.");
        return;
      }

      setAuthSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken
      });
      setUser({
        id: session.userId,
        email: session.email
      });
      saveStoredSession(session);
      setErrorMessage(null);
      setInfoMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kunde inte skapa konto. Prova en annan e-post.";
      setErrorMessage(message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = async () => {
    if (authSession) {
      await logoutSession(authSession.accessToken);
    }

    setAuthSession(null);
    setUser(null);
    setData(createEmptyData());
    setErrorMessage(null);
    setInfoMessage(null);
    clearStoredSession();
  };

  if (isSupabaseConfigured && !authSession) {
    return (
      <AuthPanel
        loading={isAuthLoading}
        errorMessage={errorMessage}
        infoMessage={infoMessage}
        onLogin={login}
        onRegister={register}
      />
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Lagbyggare för idrott</h1>
        <p>
          Skapa klasser, hantera elevlistor och generera slumpade lag med blockeringar.
          {isSupabaseConfigured && user ? ` Inloggad som ${user.email}.` : " Lokal lagring aktiv."}
        </p>
        {!isSupabaseConfigured && (
          <p className="message error">
            Supabase är inte konfigurerat ännu. Fyll i `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` i `.env` för
            att aktivera konto/inloggning.
          </p>
        )}
        <div className="button-row">
          {isSupabaseConfigured && authSession && (
            <button type="button" className="ghost" onClick={logout}>
              Logga ut
            </button>
          )}
          {isSupabaseConfigured && <span className="muted">{isSaving ? "Sparar i konto..." : "Synkat med konto"}</span>}
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
            <BlockRulesEditor classData={activeClass} onBlocksChange={updateBlocks} />
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
