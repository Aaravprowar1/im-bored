/**
 * Checks the activity library: parse errors, duplicates, the safety screen
 * and filter coverage. Prints a summary for each file named on the command
 * line (or all files).
 *
 * Usage: npx tsx scripts/check-library.ts [creative-1 ...]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_ACTIVITIES } from "../src/lib/activities/seed-data";
import { parseLibrary } from "../src/lib/activities/library/parse";
import { coverageGaps, findDuplicates, findUnsafe, groupKey } from "../src/lib/activities/library/quality";
import { CATEGORIES, type Category } from "../src/lib/activities/types";
import type { SeedActivity } from "../src/lib/activities/seed-data";

const dir = join(process.cwd(), "src/lib/activities/library");
// Files already in the generated index come first, then single categories, then
// pairs, so a duplicate is always reported against the newer, unpublished file.
const published = new Set([...readFileSync(join(dir, "index.ts"), "utf8").matchAll(/from "\.\/([^"]+)"/g)].map((m) => `${m[1]}.ts`));
const rank = (f: string) => (published.has(f) ? 0 : f.includes("+") ? 2 : 1);
const files = readdirSync(dir)
  .filter((f) => /^[a-z]+(\+[a-z]+)?-\d+\.ts$/.test(f))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const wanted = new Set(process.argv.slice(2).map((f) => f.replace(/\.ts$/, "")));

const all: SeedActivity[] = [...BASE_ACTIVITIES];
const byFile = new Map<string, SeedActivity[]>();
let failed = false;
for (const file of files) {
  const stem = file.replace(/\.ts$/, "");
  const [category, secondary = null] = stem.split("-")[0].split("+") as [Category, Category?];
  const source = readFileSync(join(dir, file), "utf8");
  const start = source.indexOf("`");
  const end = source.lastIndexOf("`");
  try {
    if (!CATEGORIES.includes(category) || (secondary && !CATEGORIES.includes(secondary))) throw new Error(`unknown category in file name`);
    if (start < 0 || end <= start) throw new Error("expected export default `...`;");
    const parsed = parseLibrary(category, source.slice(start + 1, end), file, secondary ?? null);
    byFile.set(stem, parsed);
    all.push(...parsed);
  } catch (e) {
    failed = true;
    console.log(`✗ ${file}: ${e instanceof Error ? e.message : e}`);
  }
}

const problems = [...findDuplicates(all), ...findUnsafe(all)];
const fileOf = new Map<string, string>();
for (const [stem, list] of byFile) for (const a of list) fileOf.set(a.slug, stem);

const share = (list: SeedActivity[], f: (a: SeedActivity) => boolean) => `${Math.round((100 * list.filter(f).length) / (list.length || 1))}%`;
for (const [stem, list] of byFile) {
  if (wanted.size && !wanted.has(stem)) continue;
  const mine = problems.filter((p) => fileOf.get(p.slug) === stem);
  console.log(`\n${stem}: ${list.length} activities, ${mine.length} problems`);
  console.log(
    `  time ≤5 ${share(list, (a) => a.duration_minutes <= 5)}, 6–15 ${share(list, (a) => a.duration_minutes > 5 && a.duration_minutes <= 15)}, 16–30 ${share(list, (a) => a.duration_minutes > 15 && a.duration_minutes <= 30)}, 31–60 ${share(list, (a) => a.duration_minutes > 30 && a.duration_minutes <= 60)}, 60+ ${share(list, (a) => a.duration_minutes > 60)}`,
  );
  for (const key of ["location", "energy_level", "cost_type", "people_type", "difficulty"] as const) {
    const counts = new Map<string, number>();
    for (const a of list) counts.set(a[key], (counts.get(a[key]) ?? 0) + 1);
    console.log(`  ${key}: ${[...counts].map(([k, n]) => `${k} ${Math.round((100 * n) / list.length)}%`).join(", ")}`);
  }
  console.log(`  chaos ${share(list, (a) => a.is_chaos)}, safety notes ${share(list, (a) => !!a.safety_note)}, videos ${share(list, (a) => !!a.video_query)}`);
  for (const p of mine.slice(0, 60)) console.log(`  ✗ ${p.slug}: ${p.problem}`);
  if (mine.length > 60) console.log(`  … and ${mine.length - 60} more`);
}

const pairs = new Map<string, number>();
for (const a of all) if (a.secondary_category) pairs.set(groupKey(a), (pairs.get(groupKey(a)) ?? 0) + 1);
if (pairs.size) console.log(`\nPairs: ${[...pairs].sort().map(([k, n]) => `${k} ${n}`).join(", ")}`);

console.log("\nCategory totals (single-category only, including the 130 base activities):");
for (const c of CATEGORIES) {
  const n = all.filter((a) => a.category === c && !a.secondary_category).length;
  const gaps = coverageGaps(all, c);
  console.log(`  ${c}: ${n}${gaps.length ? `, ${gaps.length} filter gaps` : ""}`);
  if (wanted.size === 0 || [...wanted].some((w) => w.startsWith(`${c}-`))) for (const g of gaps.slice(0, 15)) console.log(`    gap: ${g}`);
}
const unassigned = problems.filter((p) => !fileOf.has(p.slug));
for (const p of unassigned) console.log(`  ✗ base ${p.slug}: ${p.problem}`);
if (failed || problems.length) process.exitCode = 1;
