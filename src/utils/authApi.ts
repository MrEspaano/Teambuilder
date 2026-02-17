const AUTH_STORAGE_KEY = "lagbyggare:auth-session";

export interface AuthSession {
  accessToken: string;
  userId: string;
  email: string;
}

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

interface AuthResponsePayload {
  accessToken?: string;
  user?: {
    id?: string;
    email?: string;
  };
  message?: string;
}

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

const ensureOk = async (response: Response, fallback: string): Promise<AuthResponsePayload> => {
  const payload = await parseJson<AuthResponsePayload>(response);
  if (response.ok) {
    return payload;
  }

  throw new AuthApiError(payload.message || fallback, response.status);
};

const mapSession = (payload: AuthResponsePayload): AuthSession => {
  const accessToken = payload.accessToken;
  const userId = payload.user?.id;
  const email = payload.user?.email;

  if (!accessToken || !userId || !email) {
    throw new Error("Ogiltigt svar från servern.");
  }

  return {
    accessToken,
    userId,
    email
  };
};

export const loadStoredSession = (): AuthSession | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.userId || !parsed.email) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: AuthSession): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const signupWithEmail = async (email: string, password: string): Promise<AuthSession> => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await ensureOk(response, "Kunde inte skapa konto.");
  return mapSession(payload);
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthSession> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await ensureOk(response, "Inloggning misslyckades.");
  return mapSession(payload);
};

export const fetchCurrentUser = async (accessToken: string): Promise<{ id: string; email: string } | null> => {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await parseJson<{ user?: { id?: string; email?: string } }>(response);
  if (!payload.user?.id || !payload.user.email) {
    return null;
  }

  return {
    id: payload.user.id,
    email: payload.user.email
  };
};

export const logoutSession = async (accessToken: string): Promise<void> => {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
};
