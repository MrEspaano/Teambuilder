import type { AppData } from "../types";
import { supabaseConfig } from "../lib/supabase";
import { createEmptyData, sanitizeAppData } from "./storage";

const TABLE_NAME = "user_app_data";

export class CloudStorageError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CloudStorageError";
    this.status = status;
  }
}

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

const parseErrorMessage = (payload: Record<string, unknown> | null, fallback: string): string => {
  if (!payload) {
    return fallback;
  }

  const candidates = [payload.message, payload.error, payload.msg];
  const message = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof message === "string" ? message : fallback;
};

const ensureOk = async (response: Response, fallbackMessage: string): Promise<void> => {
  if (response.ok) {
    return;
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await parseJson<Record<string, unknown>>(response);
  } catch {
    payload = null;
  }

  throw new CloudStorageError(parseErrorMessage(payload, fallbackMessage), response.status);
};

export const isCloudAuthError = (error: unknown): boolean =>
  error instanceof CloudStorageError && (error.status === 401 || error.status === 403);

const getHeaders = (accessToken: string, withJson = false): HeadersInit => ({
  apikey: supabaseConfig.anonKey,
  Authorization: `Bearer ${accessToken}`,
  ...(withJson ? { "Content-Type": "application/json" } : {})
});

export const loadUserAppData = async (userId: string, accessToken: string): Promise<AppData> => {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: "data"
  });

  const response = await fetch(`${supabaseConfig.url}/rest/v1/${TABLE_NAME}?${query.toString()}`, {
    method: "GET",
    headers: getHeaders(accessToken)
  });

  await ensureOk(response, "Kunde inte läsa data från konto.");

  const rows = await parseJson<Array<{ data: unknown }>>(response);
  if (!rows || rows.length === 0 || !rows[0]) {
    return createEmptyData();
  }

  return sanitizeAppData(rows[0].data);
};

export const saveUserAppData = async (userId: string, data: AppData, accessToken: string): Promise<void> => {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/${TABLE_NAME}?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...getHeaders(accessToken, true),
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([
      {
        user_id: userId,
        data
      }
    ])
  });

  await ensureOk(response, "Kunde inte spara data i konto.");
};
