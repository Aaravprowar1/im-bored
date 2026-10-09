import { vi } from "vitest";

/**
 * A tiny stand-in for the Supabase JS client: records rpc calls and returns
 * canned results for table queries. Enough to exercise route handlers'
 * authentication, authorization and validation paths.
 */
export function fakeSupabase(opts: {
  user?: { id: string; email?: string } | null;
  rpc?: Record<string, { data?: unknown; error?: { message: string; code?: string } | null }>;
  tables?: Record<string, { data?: unknown; error?: unknown }>;
}) {
  const rpc = vi.fn(async (name: string) => opts.rpc?.[name] ?? { data: null, error: null });
  const updates: { table: string; values: unknown }[] = [];
  const from = vi.fn((table: string) => {
    const result = opts.tables?.[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["select", "eq", "in", "order", "limit", "range", "ilike", "gte", "lte", "delete", "upsert", "insert"]) chain[m] = vi.fn(self);
    chain.update = vi.fn((values: unknown) => {
      updates.push({ table, values });
      return chain;
    });
    chain.maybeSingle = vi.fn(async () => result);
    chain.single = vi.fn(async () => result);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  });
  return {
    client: {
      auth: {
        getUser: vi.fn(async () => (opts.user ? { data: { user: opts.user }, error: null } : { data: { user: null }, error: { message: "no session" } })),
        signOut: vi.fn(async () => ({})),
        admin: { deleteUser: vi.fn(async () => ({ error: null })) },
      },
      rpc,
      from,
    },
    rpc,
    from,
    updates,
  };
}
