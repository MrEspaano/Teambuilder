import { sql } from "@vercel/postgres";
import { getBearerToken, verifyAccessToken } from "../_lib/auth.js";
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
    const userResult = await sql`select id, email from app_users where id = ${auth.userId} limit 1`;
    const user = userResult.rows[0];

    if (!user) {
      return sendJson(res, 401, { message: "Ogiltig session." });
    }

    return sendJson(res, 200, {
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch {
    return sendJson(res, 401, { message: "Ogiltig session." });
  }
}
