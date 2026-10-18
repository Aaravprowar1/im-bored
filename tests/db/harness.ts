import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_ACTIVITIES } from "@/lib/activities/seed-data";
import { buildSeedSql } from "@/lib/activities/seed-sql";

/**
 * In-process PostgreSQL (PGlite) with a minimal emulation of Supabase:
 * the auth schema, auth.uid(), the anon/authenticated/service_role roles and
 * Supabase's default "grant all" privileges on new public tables. This lets the
 * real migration and its RLS policies be exercised in unit tests.
 */
const SUPABASE_PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type Db = PGlite;

export async function createDb({ seed = true } = {}): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_PRELUDE);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  // The starter set keeps each test fast; one test loads the whole library.
  if (seed) await db.exec(buildSeedSql(BASE_ACTIVITIES));
  return db;
}

export async function createUser(db: Db, id: string, username?: string) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id}@example.test`,
    JSON.stringify(username ? { username } : {}),
  ]);
}

/** Runs fn as a Supabase role, optionally impersonating a user (JWT sub). */
export async function as<T>(
  db: Db,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function firstPublishedActivity(db: Db, where = "true") {
  const r = await db.query<{ id: string; xp_reward: number }>(
    `select id, xp_reward from public.activities where status = 'published' and ${where} order by slug limit 1`,
  );
  return r.rows[0];
}
