import { useState } from "react";

interface AuthPanelProps {
  loading: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onGuestLogin: () => Promise<void>;
}

const AuthPanel = ({ loading, errorMessage, infoMessage, onLogin, onRegister, onGuestLogin }: AuthPanelProps) => {
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
      <div className="auth-layout">
        <span className="auth-orb auth-orb-a" aria-hidden="true" />
        <span className="auth-orb auth-orb-b" aria-hidden="true" />
        <section className="auth-hero">
          <header className="page-header page-header-auth">
            <div className="brand-header">
              <span className="app-logo" aria-hidden="true">
                TB
              </span>
              <h1>TeamBuilder</h1>
            </div>
            <p className="auth-kicker">Hej och välkommen till TeamBuilder!</p>
            <p>
              Skapa klasser, lägg in elever och generera rättvisa lag snabbt. Appen balanserar nivå, kön och regler
              så du får bättre flyt på lektionen.
            </p>
          </header>

          <div className="auth-feature-grid">
            <article className="auth-feature">
              <h3>Snabb start</h3>
              <p>Lägg till elever i två tydliga steg och börja generera lag direkt.</p>
            </article>
            <article className="auth-feature">
              <h3>Smart fördelning</h3>
              <p>Fördela nivåer jämnare och styr med spärrregler för samma/olika lag.</p>
            </article>
            <article className="auth-feature">
              <h3>Fungerar överallt</h3>
              <p>Logga in för att nå dina klasser på flera enheter, eller testa som gäst.</p>
            </article>
          </div>
        </section>

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
            <button type="button" className="ghost" onClick={onGuestLogin} disabled={loading}>
              Logga in som gäst
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthPanel;
