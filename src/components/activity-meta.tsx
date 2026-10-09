import { Clock, Gauge, MapPin, Users, Wallet, Zap } from "lucide-react";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  DIFFICULTY_LABELS,
  ENERGY_LABELS,
  LOCATION_LABELS,
  PEOPLE_LABELS,
  type Category,
  type PublicActivity,
} from "@/lib/activities/types";
import { cn } from "@/lib/cn";

// Server-safe presentational pieces shared by client and server components.

export const CATEGORY_TONES: Record<Category, string> = {
  creative: "bg-yellow",
  brain: "bg-blue",
  physical: "bg-peach",
  outdoors: "bg-green",
  indoors: "bg-[#efe9df]",
  gaming: "bg-[#e9e3f4]",
  learn: "bg-blue",
  mischief: "bg-peach",
  social: "bg-[#f6e1ea]",
  music: "bg-[#e9e3f4]",
  productivity: "bg-green",
};

export function formatMinutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-ink/10 px-3 py-1 text-xs font-medium", CATEGORY_TONES[category], className)}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function ActivityMeta({ activity }: { activity: PublicActivity }) {
  const items = [
    { icon: Clock, label: "Duration", value: formatMinutes(activity.duration_minutes) },
    { icon: Gauge, label: "Difficulty", value: DIFFICULTY_LABELS[activity.difficulty] },
    { icon: MapPin, label: "Location", value: LOCATION_LABELS[activity.location] },
    { icon: Zap, label: "Energy", value: ENERGY_LABELS[activity.energy_level].replace(" energy", "") },
    { icon: Wallet, label: "Cost", value: COST_LABELS[activity.cost_type] },
    { icon: Users, label: "People", value: PEOPLE_LABELS[activity.people_type] },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

