/**
 * Writes supabase/seed.sql from src/lib/activities/seed-data.ts.
 * The SQL upserts on slug, so running it repeatedly never duplicates rows.
 * Usage: npm run db:seed-sql
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSeedSql } from "../src/lib/activities/seed-sql";

const out = join(process.cwd(), "supabase", "seed.sql");
writeFileSync(out, buildSeedSql());
console.log(`Wrote ${out}`);
