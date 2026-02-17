import { sql } from "@vercel/postgres";
import { getBearerToken, verifyAccessToken } from "./_lib/auth.js";
import { defaultAppData, ensureSchema } from "./_lib/db.js";
import { methodNotAllowed, readJsonBody, sendJson } from "./_lib/http.js";

const getAuthorizedUser = async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { message: "Saknar behörighet." });
    return null;
  }

  try {
    const auth = await verifyAccessToken(token);
    return auth;
  } catch {
    sendJson(res, 401, { message: "Ogiltig session." });
    return null;
  }
};

export default async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method || "")) {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  try {
    await ensureSchema();

    const auth = await getAuthorizedUser(req, res);
    if (!auth) {
      return;
    }

    if (req.method === "GET") {
      const rowResult = await sql`select data from user_app_data where user_id = ${auth.userId} limit 1`;
      const row = rowResult.rows[0];

      if (!row) {
        const freshData = defaultAppData();
        await sql`insert into user_app_data (user_id, data) values (${auth.userId}, ${JSON.stringify(freshData)}::jsonb)`;
        return sendJson(res, 200, { data: freshData });
      }

      return sendJson(res, 200, { data: row.data ?? defaultAppData() });
    }

    const body = await readJsonBody(req);
    const data = body?.data;
    if (!data || typeof data !== "object") {
      return sendJson(res, 400, { message: "Ogiltig data." });
    }

    await sql`
      insert into user_app_data (user_id, data, updated_at)
      values (${auth.userId}, ${JSON.stringify(data)}::jsonb, now())
      on conflict (user_id)
      do update set data = excluded.data, updated_at = now()
    `;

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Serverfel.";
    return sendJson(res, 500, { message });
  }
}
