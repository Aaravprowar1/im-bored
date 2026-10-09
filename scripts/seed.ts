/**
 * Seeds the activity library through the Supabase API using the service role.
 * Idempotent: rows are upserted on slug, so re-running never duplicates.
 * Seed rows that an admin archived are left archived.
 *
 * Usage: npm run db:seed   (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local)
 * Alternative: run supabase/seed.sql in the Supabase SQL editor.
 */
import { createClient } from "@supabase/supabase-js";
import { SEED_ACTIVITIES } from "../src/lib/activities/seed-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example in .env.local).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: existing, error } = await supabase.from("activities").select("slug,status,source");
  if (error) throw new Error(`Could not read activities: ${error.message}`);
  const archived = new Set((existing ?? []).filter((r) => r.status === "archived" || r.source !== "seed").map((r) => r.slug));

  const rows = SEED_ACTIVITIES.filter((a) => !archived.has(a.slug)).map((a) => ({ ...a, status: "published", source: "seed" }));
  const isNew = (slug: string) => !(existing ?? []).some((r) => r.slug === slug);

  const { error: upsertError } = await supabase.from("activities").upsert(
    rows.map((r) => (isNew(r.slug) ? { ...r, published_at: new Date().toISOString() } : r)),
    { onConflict: "slug" },
  );
  if (upsertError) throw new Error(`Seed failed: ${upsertError.message}`);
  console.log(`Seeded ${rows.length} activities (${rows.filter((r) => isNew(r.slug)).length} new, ${archived.size} skipped).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
