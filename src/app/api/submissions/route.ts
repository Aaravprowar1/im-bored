import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiOk, fromDbError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { OWNER_SUBMISSION_COLUMNS } from "@/lib/submissions/types";
import { createSubmissionSchema, fieldErrors } from "@/lib/validation";

/** The caller's own submission history (RLS restricts rows to the owner). */
export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up yet.");
  if (!user) return apiError("unauthenticated", "Please sign in.");
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(OWNER_SUBMISSION_COLUMNS)
    .eq("submitter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fromDbError(error);
  return apiOk({ submissions: data ?? [] });
}

/**
 * Validates and stores a submission, which goes straight to the review queue.
 * Status and owner are set by the database, never by the request; unknown
 * fields in the body are discarded by the schema.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return apiError("not_configured", "Accounts aren't set up on this site yet, so submissions are closed.");
  if (!user) return apiError("unauthenticated", "Sign in to submit an activity.");
  if (!rateLimit(`submit:${user.id}`, 10, 60_000).ok) return apiError("rate_limited", "Slow down a little.");

  const parsed = createSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const s = parsed.data;

  const { data, error } = await supabase.rpc("create_submission", {
    p_client_request_id: s.client_request_id,
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
  return apiOk({ id: data as string }, { status: 201 });
}
