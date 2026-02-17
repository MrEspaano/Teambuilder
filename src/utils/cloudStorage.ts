import type { AppData } from "../types";
import { createEmptyData, sanitizeAppData } from "./storage";

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
  Authorization: `Bearer ${accessToken}`,
  ...(withJson ? { "Content-Type": "application/json" } : {})
});

export const loadUserAppData = async (accessToken: string): Promise<AppData> => {
  const response = await fetch("/api/user-data", {
    method: "GET",
    headers: getHeaders(accessToken)
  });

  await ensureOk(response, "Kunde inte läsa data från konto.");

  const payload = await parseJson<{ data?: unknown }>(response);
  if (!payload || payload.data === undefined) {
    return createEmptyData();
  }

  return sanitizeAppData(payload.data);
};

export const saveUserAppData = async (data: AppData, accessToken: string): Promise<void> => {
  const response = await fetch("/api/user-data", {
    method: "PUT",
    headers: getHeaders(accessToken, true),
    body: JSON.stringify({ data })
  });

  await ensureOk(response, "Kunde inte spara data i konto.");
};
