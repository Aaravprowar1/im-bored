"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/confirm-dialog";
import { describedBy, Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";

type Profile = { username: string; display_name: string | null; avatar_url: string | null; show_on_leaderboard: boolean };

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ username: profile.username, display_name: profile.display_name ?? "", avatar_url: profile.avatar_url ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await api("/api/profile", { method: "PATCH", body: JSON.stringify(values) });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fields ?? {});
      return toast(res.error.message, "error");
    }
    setErrors({});
    toast("Profile saved.", "success");
    router.refresh();
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-3xl">Profile</h2>
      <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
        <Field id="username" label="Username" hint="Lowercase letters, numbers and underscores. Shown publicly on the leaderboard." error={errors.username}>
          <Input id="username" value={values.username} onChange={set("username")} maxLength={24} aria-invalid={Boolean(errors.username)} aria-describedby={describedBy("username", errors.username, "x")} />
        </Field>
        <Field id="display_name" label="Display name" hint="Optional. Up to 40 characters." error={errors.display_name}>
          <Input id="display_name" value={values.display_name} onChange={set("display_name")} maxLength={40} aria-invalid={Boolean(errors.display_name)} aria-describedby={describedBy("display_name", errors.display_name, "x")} />
        </Field>
        <Field id="avatar_url" label="Avatar image URL" hint="Optional. An https:// link to an image. Leave empty to use your initials." error={errors.avatar_url}>
          <Input id="avatar_url" type="url" value={values.avatar_url} onChange={set("avatar_url")} aria-invalid={Boolean(errors.avatar_url)} aria-describedby={describedBy("avatar_url", errors.avatar_url, "x")} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save profile</Button>
      </form>
    </Card>
  );
}

export function PrivacySettings({ showOnLeaderboard }: { showOnLeaderboard: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(showOnLeaderboard);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    const next = !checked;
    setChecked(next);
    setBusy(true);
    const res = await api("/api/profile", { method: "PATCH", body: JSON.stringify({ show_on_leaderboard: next }) });
    setBusy(false);
    if (!res.ok) {
      setChecked(!next);
      return toast(res.error.message, "error");
    }
    toast(next ? "You're visible on the leaderboard." : "You're hidden from the leaderboard.", "success");
    router.refresh();
  }
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-3xl">Privacy</h2>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p id="lb-label" className="font-medium">Show me on the leaderboard</p>
          <p id="lb-desc" className="mt-1 text-sm text-muted">Shows your username, display name, avatar, XP and level. Your email is never shown.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby="lb-label"
          aria-describedby="lb-desc"
          disabled={busy}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-line"}`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-card shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </Card>
  );
}

export function DangerZone() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const res = await api("/api/account", { method: "DELETE", body: JSON.stringify({ confirm }) });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    toast("Your account has been deleted.");
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-3xl">Account</h2>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">Sign out</Button>
        </form>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete account…</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <p className="text-sm leading-relaxed text-muted">
          This permanently deletes your profile, XP, completions and favourites. Paid submissions keep their payment and review records without your name, as described in the privacy policy. This can&apos;t be undone.
        </p>
        {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
        <Field id="confirm-delete" label='Type "DELETE" to confirm' className="mt-4">
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={confirm !== "DELETE" || busy} onClick={deleteAccount}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Delete forever
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
