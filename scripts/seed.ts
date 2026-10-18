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

async function existingRows() {
  // The API returns at most 1,000 rows per request, so read in pages.
  const rows: { slug: string; status: string; source: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("activities").select("slug,status,source").order("slug").range(from, from + 999);
    if (error) throw new Error(`Could not read activities: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  const existing = await existingRows();
  const known = new Set(existing.map((r) => r.slug));
  const skipped = new Set(existing.filter((r) => r.status === "archived" || r.source !== "seed").map((r) => r.slug));

  const now = new Date().toISOString();
  const rows = SEED_ACTIVITIES.filter((a) => !skipped.has(a.slug)).map((a) => ({
    ...a,
    status: "published",
    source: "seed",
    ...(known.has(a.slug) ? {} : { published_at: now }),
  }));

  // Rows with and without published_at go in separate requests so existing
  // rows keep their original publish date.
  const fresh = rows.filter((r) => "published_at" in r);
  const refresh = rows.filter((r) => !("published_at" in r));
  for (const group of [fresh, refresh]) {
    for (let i = 0; i < group.length; i += 500) {
      const { error } = await supabase.from("activities").upsert(group.slice(i, i + 500), { onConflict: "slug" });
      if (error) throw new Error(`Seed failed: ${error.message}`);
    }
  }
  console.log(`Seeded ${rows.length} activities (${fresh.length} new, ${skipped.size} skipped).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
