"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { api } from "@/lib/api-client";
import { readGuestFavourites, writeGuestFavourites } from "@/lib/guest-favourites";

/**
 * Favourites for the current visitor: synced to the account when signed in,
 * otherwise stored on this device. Account changes are optimistic and rolled
 * back if the server rejects them.
 */
export function useFavourites() {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const isAccount = Boolean(viewer.user);
  const [ids, setIds] = useState<Set<string>>(() => new Set(viewer.favouriteIds));
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Re-sync from the server (account) or localStorage (guest) after hydration
  // and whenever the signed-in state changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAccount) setIds(new Set(viewer.favouriteIds));
    else setIds(new Set(readGuestFavourites()));
  }, [isAccount, viewer.favouriteIds]);

  const toggle = useCallback(
    async (activityId: string) => {
      const wasSaved = ids.has(activityId);
      const apply = (saved: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(activityId);
          else next.delete(activityId);
          return next;
        });

      if (!isAccount) {
        const next = wasSaved ? [...ids].filter((x) => x !== activityId) : [...ids, activityId];
        writeGuestFavourites(next);
        apply(!wasSaved);
        toast(wasSaved ? "Removed from favourites on this device." : "Saved on this device. Sign in to keep favourites across devices.");
        return;
      }

      if (pending.has(activityId)) return;
      setPending((p) => new Set(p).add(activityId));
      apply(!wasSaved);
      const res = await api("/api/favourites", {
        method: wasSaved ? "DELETE" : "POST",
        body: JSON.stringify({ activityId }),
      });
      setPending((p) => {
        const next = new Set(p);
        next.delete(activityId);
        return next;
      });
      if (!res.ok) {
        apply(wasSaved);
        toast(res.error.message, "error");
        return;
      }
      toast(wasSaved ? "Removed from favourites." : "Saved to your favourites.", "success");
      router.refresh();
    },
    [ids, isAccount, pending, router, toast],
  );

  return { ids, toggle, isAccount, pending };
}
