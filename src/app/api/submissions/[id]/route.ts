import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { OWNER_SUBMISSION_COLUMNS } from "@/lib/submissions/types";
import { fieldErrors, submissionFieldsSchema, uuidSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** Status for the submission's owner. Other users get 404 (RLS returns no row). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up yet.");
  if (!user) return apiError("unauthenticated", "Please sign in.");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "Submission not found.");
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(OWNER_SUBMISSION_COLUMNS)
    .eq("id", id)
    .eq("submitter_id", user.id)
    .maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return apiError("not_found", "Submission not found.");
  return apiOk({ submission: data });
}

/** Resubmits after a moderator requested changes. No new payment. */
export async function PATCH(request: Request, { params }: Params) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up yet.");
  if (!user) return apiError("unauthenticated", "Please sign in.");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError("not_found", "Submission not found.");
  const parsed = submissionFieldsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const s = parsed.data;
  const { error } = await supabase.rpc("resubmit_submission", {
    p_submission_id: id,
    p_title: s.title,
    p_description: s.description,
    p_category: s.category,
    p_duration_minutes: s.duration_minutes,
    p_difficulty: s.difficulty,
    p_location: s.location,
    p_energy_level: s.energy_level,
    p_cost_type: s.cost_type,
    p_people_type: s.people_type,
  });
  if (error) return fromDbError(error);
  return apiOk({ resubmitted: true });
}
