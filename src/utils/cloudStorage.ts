import type { AppData } from "../types";
import { supabaseConfig } from "../lib/supabase";
import { createEmptyData, sanitizeAppData } from "./storage";

const TABLE_NAME = "user_app_data";

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

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

  if (!response.ok) {
    throw new Error("Kunde inte läsa data från konto.");
  }

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

  if (!response.ok) {
    throw new Error("Kunde inte spara data i konto.");
  }
};
