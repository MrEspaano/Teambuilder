import { sql } from "@vercel/postgres";
import { getBearerToken, isAdminEmail, verifyAccessToken } from "../_lib/auth.js";
import { ensureSchema } from "../_lib/db.js";
import { methodNotAllowed, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const token = getBearerToken(req);
  if (!token) {
    return sendJson(res, 401, { message: "Saknar behörighet." });
  }

  try {
    await ensureSchema();

    const auth = await verifyAccessToken(token);
    if (!isAdminEmail(auth.email)) {
      return sendJson(res, 403, { message: "Saknar adminbehörighet." });
    }

    const result = await sql`
      select id, email, created_at
      from app_users
      order by created_at desc
    `;

    return sendJson(res, 200, {
      users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        createdAt: row.created_at
      }))
    });
  } catch {
    return sendJson(res, 401, { message: "Ogiltig session." });
  }
}
