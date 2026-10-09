import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DangerZone, PrivacySettings, ProfileSettingsForm } from "@/components/profile/settings-forms";
import { Card, Container, Notice, PageHeading } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) {
    return (
      <Container className="pt-12 sm:pt-16">
        <PageHeading title="Settings" />
        <Notice tone="warning">Accounts aren&apos;t set up on this site yet, so there are no settings to change.</Notice>
      </Container>
    );
  }
  if (!user) redirect("/login?next=/settings");
  const viewer = await getViewer();
  const profile = viewer.user!;
  return (
    <Container className="max-w-3xl pt-12 sm:pt-16">
      <PageHeading title="Settings" />
      <div className="space-y-4">
        <ProfileSettingsForm profile={profile} />
        <Card className="p-6 sm:p-8">
          <h2 className="font-serif text-3xl">Account preferences</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Password</dt>
              <dd><Link className="underline underline-offset-4" href="/forgot-password">Send a password reset link</Link></dd>
            </div>
          </dl>
        </Card>
        <PrivacySettings showOnLeaderboard={profile.show_on_leaderboard} />
        <DangerZone />
      </div>
    </Container>
  );
}
