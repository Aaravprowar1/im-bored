import { z } from "zod";

/**
 * Public configuration (safe for the browser). NEXT_PUBLIC_* values are inlined
 * at build time, so they must be read with literal property access.
 */
const publicSchema = z.object({
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(20).optional(),
  siteUrl: z.string().url().default("http://localhost:3000"),
  contactEmail: z.string().email().optional(),
});

function emptyToUndefined(v: string | undefined) {
  return v && v.trim() !== "" ? v.trim() : undefined;
}

const parsedPublic = publicSchema.safeParse({
  supabaseUrl: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  contactEmail: emptyToUndefined(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
});

if (!parsedPublic.success) {
  // Fail loudly on malformed values rather than silently running half-configured.
  throw new Error(`Invalid public environment variables: ${parsedPublic.error.message}`);
}

export const publicConfig = parsedPublic.data;

export function isSupabaseConfigured(): boolean {
  return Boolean(publicConfig.supabaseUrl && publicConfig.supabaseAnonKey);
}

export const SITE_NAME = "im bored.";
