import { supabaseConfig } from "../lib/supabase";

const AUTH_STORAGE_KEY = "lagbyggare:auth-session";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
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

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
  error_description?: string;
  message?: string;
  error?: string;
  msg?: string;
}

const getAuthHeaders = (): HeadersInit => ({
  apikey: supabaseConfig.anonKey,
  "Content-Type": "application/json"
});

const mapAuthResponse = (payload: SupabaseAuthResponse): AuthSession | null => {
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;
  const userId = payload.user?.id;
  const email = payload.user?.email;

  if (!accessToken || !refreshToken || !userId || !email) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    userId,
    email
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

const resolveErrorMessage = (payload: SupabaseAuthResponse): string =>
  payload.error_description || payload.message || payload.error || payload.msg || "Ett okänt fel inträffade.";

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
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.userId || !parsed.email) {
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

export const signupWithEmail = async (email: string, password: string): Promise<AuthSession | null> => {
  const response = await fetch(`${supabaseConfig.url}/auth/v1/signup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, password })
  });

  const payload = await parseJson<SupabaseAuthResponse>(response);
  if (!response.ok) {
    throw new AuthApiError(resolveErrorMessage(payload), response.status);
  }

  const immediateSession = mapAuthResponse(payload);
  if (immediateSession) {
    return immediateSession;
  }

  try {
    return await loginWithEmail(email, password);
  } catch {
    // If email confirmation is enforced, login can fail even though account exists.
    return null;
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthSession> => {
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, password })
  });

  const payload = await parseJson<SupabaseAuthResponse>(response);
  if (!response.ok) {
    throw new AuthApiError(resolveErrorMessage(payload), response.status);
  }

  const session = mapAuthResponse(payload);
  if (!session) {
    throw new Error("Inloggning lyckades inte. Kontrollera dina uppgifter.");
  }

  return session;
};

export const refreshSession = async (refreshToken: string): Promise<AuthSession> => {
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const payload = await parseJson<SupabaseAuthResponse>(response);
  if (!response.ok) {
    throw new AuthApiError(resolveErrorMessage(payload), response.status);
  }

  const session = mapAuthResponse(payload);
  if (!session) {
    throw new AuthApiError("Kunde inte förnya sessionen.", response.status);
  }

  return session;
};

export const fetchCurrentUser = async (accessToken: string): Promise<{ id: string; email: string } | null> => {
  const response = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await parseJson<{ id?: string; email?: string }>(response)) ?? {};
  if (!payload.id || !payload.email) {
    return null;
  }

  return {
    id: payload.id,
    email: payload.email
  };
};

export const logoutSession = async (accessToken: string): Promise<void> => {
  await fetch(`${supabaseConfig.url}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
};
