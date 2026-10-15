import "server-only";
import { z } from "zod";

/** Server-only secrets. Never import this module from client components. */
const serverSchema = z.object({
  supabaseServiceRoleKey: z.string().min(20).optional(),
});

function clean(v: string | undefined) {
  return v && v.trim() !== "" ? v.trim() : undefined;
}

let cached: z.infer<typeof serverSchema> | null = null;

export function serverConfig() {
  if (!cached) {
    const parsed = serverSchema.safeParse({
      supabaseServiceRoleKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    if (!parsed.success) {
      // Only names and rules are reported, never values.
      throw new Error(`Invalid server environment variables: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(serverConfig().supabaseServiceRoleKey);
}
