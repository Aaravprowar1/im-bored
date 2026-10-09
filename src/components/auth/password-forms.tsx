"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { describedBy, Field, Input } from "@/components/ui/form";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { passwordSchema } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    // Same message whether or not the account exists, so emails can't be probed.
    setSent(true);
  }

  if (sent) {
    return <Notice tone="success" title="Check your email">If an account uses that address, a reset link is on its way.</Notice>;
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="email" label="Email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || !email}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setFormError("Your reset link has expired. Request a new one.");
      return;
    }
    router.replace("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Field id="password" label="New password" hint="At least 10 characters, with a letter and a number." error={error ?? undefined}>
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy("password", error ?? undefined, "x")} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save new password
      </Button>
    </form>
  );
}
