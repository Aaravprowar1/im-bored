"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { describedBy, Field, Input } from "@/components/ui/form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fieldErrors, passwordSchema } from "@/lib/validation";

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3 to 24 lowercase letters, numbers or underscores."),
  email: z.string().trim().email("Enter a valid email address."),
  password: passwordSchema,
});

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setFormError(null);
    const dest = safeRedirectPath(next);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // The database trigger normalises this and makes it unique.
        data: { username: parsed.data.username },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}`,
      },
    });
    setBusy(false);
    if (error) {
      setFormError(/password/i.test(error.message) ? error.message : "We couldn't create that account. Check your details and try again.");
      return;
    }
    if (data.session) {
      router.replace(dest);
      router.refresh();
    } else {
      setSentTo(parsed.data.email);
    }
  }

  if (sentTo) {
    return (
      <Notice tone="success" title="Check your email">
        If {sentTo} can be used for a new account, we&apos;ve sent a confirmation link to it. Open it to finish signing up.
      </Notice>
    );
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Field id="username" label="Username" hint="Shown on the leaderboard. Letters, numbers and underscores." error={errors.username}>
        <Input id="username" autoComplete="username" value={values.username} onChange={set("username")} aria-invalid={Boolean(errors.username)} aria-describedby={describedBy("username", errors.username, "x")} maxLength={24} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email", errors.email)} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters, with a letter and a number." error={errors.password}>
        <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={set("password")} aria-invalid={Boolean(errors.password)} aria-describedby={describedBy("password", errors.password, "x")} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Create account
      </Button>
      <p className="text-xs leading-relaxed text-muted">
        By signing up you agree to our <a className="underline" href="/terms">terms</a> and <a className="underline" href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}
