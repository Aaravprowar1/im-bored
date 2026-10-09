/** Daily challenges reset at 00:00 UTC. */
export function utcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function msUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

/** FNV-1a hash, used for the local (no database) deterministic daily pick. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickForDate<T extends { id: string }>(pool: readonly T[], date: string, sortKey: (t: T) => string): T | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return sorted[hashString(date) % sorted.length];
}
