/**
 * Guest favourites live only in this browser's localStorage. They hold
 * activity ids and nothing else, and are labelled "saved on this device".
 */
const KEY = "imbored:guest-favourites:v1";

export function readGuestFavourites(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && x.length <= 64).slice(0, 200) : [];
  } catch {
    return [];
  }
}

export function writeGuestFavourites(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 200)));
  } catch {
    // Storage may be unavailable (private mode). Favourites then last for this page only.
  }
}
