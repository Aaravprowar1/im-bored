"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { CategoryBadge, formatMinutes } from "@/components/activity-meta";
import { VoteButtons } from "@/components/votes";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { useFavourites } from "@/components/use-favourites";
import { api } from "@/lib/api-client";
import type { PublicActivity } from "@/lib/activities/types";

/** Account favourites are passed in from the server; device favourites are loaded by id. */
export function FavouritesList({ accountActivities }: { accountActivities: PublicActivity[] | null }) {
  const favourites = useFavourites();
  const [deviceActivities, setDeviceActivities] = useState<PublicActivity[] | null>(null);
  const isDevice = accountActivities === null;

  // Guest ids load from localStorage after hydration, so fetch whenever the set
  // contains ids we haven't loaded yet.
  const idsKey = [...favourites.ids].sort().join(",");
  useEffect(() => {
    if (!isDevice || !idsKey) return;
    const loaded = new Set((deviceActivities ?? []).map((a) => a.id));
    if (idsKey.split(",").every((id) => loaded.has(id))) return;
    api<{ activities: PublicActivity[] }>(`/api/activities?ids=${encodeURIComponent(idsKey)}`).then((r) =>
      setDeviceActivities(r.ok ? r.data.activities : []),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevice, idsKey]);

  const source = isDevice ? (favourites.ids.size === 0 ? [] : deviceActivities) : accountActivities;
  const list = source?.filter((a) => favourites.ids.has(a.id)) ?? null;

  if (list === null) return <p className="text-sm text-muted">Loading favourites…</p>;
  if (list.length === 0) {
    return (
      <EmptyState title="No favourites yet." action={<ButtonLink href="/" variant="secondary">Find something to do</ButtonLink>}>
        Tap the heart on any activity to keep it here{isDevice ? " (saved on this device)" : ""}.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((a) => (
        <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CategoryBadge category={a.category} />
              {a.secondary_category ? <CategoryBadge category={a.secondary_category} /> : null}
              <span className="text-xs text-muted">{formatMinutes(a.duration_minutes)}</span>
            </div>
            <p className="mt-2 font-medium">{a.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{a.description}</p>
            <VoteButtons activity={a} size="sm" className="mt-3" />
          </div>
          <button
            type="button"
            onClick={() => favourites.toggle(a.id)}
            disabled={favourites.pending.has(a.id)}
            aria-label={`Remove "${a.title}" from favourites`}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-ink bg-ink text-bg"
          >
            <Heart className="size-4 fill-current" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
