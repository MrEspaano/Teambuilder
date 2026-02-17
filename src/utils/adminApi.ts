import { AuthApiError } from "./authApi";

interface AdminUsersPayload {
  users?: Array<{
    id?: string;
    email?: string;
    createdAt?: string;
  }>;
  message?: string;
}

export interface AdminAccountUser {
  id: string;
  email: string;
  createdAt: string | null;
}

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

export const fetchAdminAccountEmails = async (accessToken: string): Promise<AdminAccountUser[]> => {
  const response = await fetch("/api/admin/account-emails", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await parseJson<AdminUsersPayload>(response);
  if (!response.ok) {
    throw new AuthApiError(payload.message || "Kunde inte läsa kontolista.", response.status);
  }

  const users = payload.users ?? [];
  return users
    .filter((user): user is { id: string; email: string; createdAt?: string } => Boolean(user.id && user.email))
    .map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt || null
    }));
};
