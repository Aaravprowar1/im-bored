import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const tones = {
  card: "bg-card",
  yellow: "bg-yellow",
  peach: "bg-peach",
  green: "bg-green",
  blue: "bg-blue",
} as const;

export function Card({ tone = "card", className, ...props }: ComponentProps<"div"> & { tone?: keyof typeof tones }) {
  return <div className={cn("rounded-2xl border border-line shadow-soft", tones[tone], className)} {...props} />;
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs font-medium uppercase tracking-[0.14em] text-muted", className)} {...props} />;
}

export function PageHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-8 sm:mb-10">
      <h1 className="font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl">{title}</h1>
      {intro ? <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{intro}</p> : null}
    </header>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-blue border-line",
    warning: "bg-yellow border-line",
    error: "bg-[#fbe6e4] border-[#efc9c5] text-[#5e1d18]",
    success: "bg-green border-line",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", styles, className)}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "text-[0.925rem] leading-relaxed opacity-90")}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <p className="font-serif text-2xl">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
