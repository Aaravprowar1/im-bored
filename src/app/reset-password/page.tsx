import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Notice } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const { supabase, user } = await getSessionUser();
  return (
    <AuthShell title="New password.">
      {supabase && !user ? (
        <Notice tone="warning">
          This page needs a valid reset link. <Link className="underline" href="/forgot-password">Request a new one</Link>.
        </Notice>
      ) : (
        <ResetPasswordForm />
      )}
    </AuthShell>
  );
}
