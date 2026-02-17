import { useState } from "react";

interface AuthPanelProps {
  loading: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

const AuthPanel = ({ loading, errorMessage, infoMessage, onLogin, onRegister }: AuthPanelProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError("Fyll i både e-post och lösenord.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Lösenordet måste vara minst 6 tecken.");
      return;
    }

    setLocalError(null);
    if (mode === "login") {
      await onLogin(trimmedEmail, password);
      return;
    }

    await onRegister(trimmedEmail, password);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Lagbyggare för idrott</h1>
        <p>Logga in för att komma åt dina egna klasser och dela appen med kollegor.</p>
      </header>

      <main className="panel auth-panel">
        <h2>{mode === "login" ? "Logga in" : "Skapa konto"}</h2>
        <p className="muted">E-post och lösenord räcker för konto. Dina klasser sparas i ditt konto och följer med mellan enheter.</p>

        <div className="input-row">
          <input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="input-row">
          <input
            type="password"
            placeholder="Lösenord"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {localError && <p className="message error">{localError}</p>}
        {errorMessage && <p className="message error">{errorMessage}</p>}
        {infoMessage && <p className="message success">{infoMessage}</p>}

        <div className="button-row">
          <button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Vänta..." : mode === "login" ? "Logga in" : "Skapa konto"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setMode((current) => (current === "login" ? "register" : "login"));
              setLocalError(null);
            }}
            disabled={loading}
          >
            {mode === "login" ? "Jag vill skapa konto" : "Jag har redan konto"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default AuthPanel;
