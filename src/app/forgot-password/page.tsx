import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot it?" intro="We'll email you a link to choose a new password." footer={<Link className="underline underline-offset-4" href="/login">Back to log in</Link>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
