import { getSessionUser } from "@/lib/auth/session";
import { getTodaysChallenge } from "@/lib/daily/challenge";
import { msUntilUtcMidnight } from "@/lib/daily/dates";
import { apiError, apiOk } from "@/lib/http";

export async function GET() {
  const { supabase } = await getSessionUser();
  try {
    const challenge = await getTodaysChallenge(supabase);
    return apiOk({ challenge, resetsInMs: msUntilUtcMidnight(), timezone: "UTC" });
  } catch {
    return apiError("server_error", "Couldn't load today's challenge.");
  }
}
