import { sql } from "@vercel/postgres";

const DEFAULT_DATA = {
  version: 3,
  activeClassId: null,
  classes: []
};

let schemaPromise;

export const ensureSchema = async () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        create table if not exists app_users (
          id text primary key,
          email text not null unique,
          password_hash text not null,
          created_at timestamptz not null default now()
        )
      `;

      await sql`
        create unique index if not exists app_users_email_lower_idx
        on app_users (lower(email))
      `;

      await sql`
        create table if not exists user_app_data (
          user_id text primary key references app_users (id) on delete cascade,
          data jsonb not null default '{"version":3,"activeClassId":null,"classes":[]}'::jsonb,
          updated_at timestamptz not null default now()
        )
      `;
    })();
  }

  await schemaPromise;
};

export const defaultAppData = () => structuredClone(DEFAULT_DATA);
