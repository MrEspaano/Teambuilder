import crypto from "node:crypto";
import { sql } from "@vercel/postgres";
import { createAccessToken, hashPassword, validateCredentials } from "../_lib/auth.js";
import { defaultAppData, ensureSchema } from "../_lib/db.js";
import { methodNotAllowed, readJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await ensureSchema();

    const body = await readJsonBody(req);
    const validation = validateCredentials(body.email, body.password);
    if (!validation.ok) {
      return sendJson(res, 400, { message: validation.message });
    }

    const email = validation.email;
    const passwordHash = await hashPassword(body.password);
    const userId = crypto.randomUUID();

    const existing = await sql`select id from app_users where lower(email) = lower(${email}) limit 1`;
    if (existing.rowCount > 0) {
      return sendJson(res, 409, { message: "E-postadressen används redan." });
    }

    await sql`insert into app_users (id, email, password_hash) values (${userId}, ${email}, ${passwordHash})`;
    await sql`
      insert into user_app_data (user_id, data)
      values (${userId}, ${JSON.stringify(defaultAppData())}::jsonb)
      on conflict (user_id) do nothing
    `;

    const accessToken = await createAccessToken({ userId, email });
    return sendJson(res, 201, {
      accessToken,
      user: {
        id: userId,
        email
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte skapa konto.";
    return sendJson(res, 500, { message });
  }
}
