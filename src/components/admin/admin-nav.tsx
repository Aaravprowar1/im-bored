import Link from "next/link";
import { cn } from "@/lib/cn";

export function AdminNav({ active }: { active: "submissions" | "activities" }) {
  const item = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn("rounded-full px-4 py-2 text-sm", active === key ? "bg-ink text-bg" : "text-muted hover:text-ink")}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Admin" className="mb-8 flex gap-1">
      {item("/admin", "submissions", "Submissions")}
      {item("/admin/activities", "activities", "Activities & daily challenge")}
    </nav>
  );
}
