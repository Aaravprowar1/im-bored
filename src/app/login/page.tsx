import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next);
  const { user } = await getSessionUser();
  if (user) redirect(next);
  return (
    <AuthShell title="Welcome back." footer={<>New here? <Link className="font-medium text-ink underline underline-offset-4" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}>
      <LoginForm next={next} linkError={sp.error === "link"} />
    </AuthShell>
  );
}
