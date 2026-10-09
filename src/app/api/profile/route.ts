import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { fieldErrors, profileUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up yet.");
  if (!user) return apiError("unauthenticated", "Please sign in.");
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const update = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(update).length === 0) return apiOk({ updated: false });
  // Column grants limit this to username, display_name, avatar_url and show_on_leaderboard.
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return apiError("conflict", "That username is taken.", { username: "That username is taken." });
    return fromDbError(error);
  }
  return apiOk({ updated: true });
}
