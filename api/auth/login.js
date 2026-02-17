import { sql } from "@vercel/postgres";
import { createAccessToken, normalizeEmail, verifyPassword } from "../_lib/auth.js";
import { ensureSchema } from "../_lib/db.js";
import { methodNotAllowed, readJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await ensureSchema();

    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !password) {
      return sendJson(res, 400, { message: "Fyll i både e-post och lösenord." });
    }

    const userResult = await sql`
      select id, email, password_hash
      from app_users
      where lower(email) = lower(${email})
      limit 1
    `;

    const user = userResult.rows[0];
    if (!user) {
      return sendJson(res, 401, { message: "Fel e-post eller lösenord." });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return sendJson(res, 401, { message: "Fel e-post eller lösenord." });
    }

    const accessToken = await createAccessToken({ userId: user.id, email: user.email });

    return sendJson(res, 200, {
      accessToken,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inloggning misslyckades.";
    return sendJson(res, 500, { message });
  }
}
