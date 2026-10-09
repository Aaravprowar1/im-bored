import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getSessionUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next);
  const { user } = await getSessionUser();
  if (user) redirect(next);
  return (
    <AuthShell
      title="Join in."
      intro="Save favourites, earn XP and submit your own activities."
      footer={<>Already have an account? <Link className="font-medium text-ink underline underline-offset-4" href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link></>}
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
