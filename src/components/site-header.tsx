"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Shield, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { useViewer } from "@/components/viewer-context";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif text-[1.65rem] leading-none tracking-tight", className)}>
      im bored<span className="text-muted">.</span>
    </span>
  );
}

export function SiteHeader() {
  const viewer = useViewer();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="im bored. home" className="rounded-md">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors",
                isActive(item.href) ? "bg-ink/[0.06] text-ink" : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {viewer.user ? (
            <>
              {viewer.isAdmin ? (
                <Link href="/admin" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
                  <Shield className="size-4" aria-hidden /> Admin
                </Link>
              ) : null}
              <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm hover:bg-ink/5">
                <Avatar name={viewer.user.display_name ?? viewer.user.username} url={viewer.user.avatar_url} size={30} />
                <span className="max-w-[10rem] truncate">{viewer.user.display_name ?? viewer.user.username}</span>
              </Link>
            </>
          ) : (
            <>
              <ButtonLink href={loginHref} variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-line bg-bg md:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base hover:bg-ink/5"
              >
                {item.label}
              </Link>
            ))}
            {viewer.isAdmin ? (
              <Link href="/admin" onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base hover:bg-ink/5">
                Admin
              </Link>
            ) : null}
            <div className="mt-2 flex gap-2 border-t border-line pt-4">
              {viewer.user ? (
                <ButtonLink href="/profile" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Your profile
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={loginHref} variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                    Log in
                  </ButtonLink>
                  <ButtonLink href="/signup" className="flex-1" onClick={() => setOpen(false)}>
                    Sign up
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
