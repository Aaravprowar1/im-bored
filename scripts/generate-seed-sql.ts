/**
 * Writes supabase/seed.sql from src/lib/activities/seed-data.ts and the
 * library in src/lib/activities/library.
 * The SQL upserts on slug, so running it repeatedly never duplicates rows.
 * Usage: npm run db:seed-sql
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_ACTIVITIES } from "../src/lib/activities/seed-data";
import { buildSeedSql } from "../src/lib/activities/seed-sql";

const out = join(process.cwd(), "supabase", "seed.sql");
writeFileSync(out, buildSeedSql());
console.log(`Wrote ${SEED_ACTIVITIES.length} activities to ${out}`);
