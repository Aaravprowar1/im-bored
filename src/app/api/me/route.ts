import { apiOk } from "@/lib/http";
import { getViewer } from "@/lib/viewer";

/** Private, per-user data. Never cached by shared caches. */
export async function GET() {
  const viewer = await getViewer();
  // Email is only returned to its owner, and only on this private endpoint.
  return apiOk(viewer);
}
