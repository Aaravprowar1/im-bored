import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Privacy", description: "What data im bored. collects and why." };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" updated="[date]" draft>
      <p>This policy explains what {OPERATOR} (&ldquo;we&rdquo;) collects when you use im bored., why, and what you can do about it.</p>
      <h2>Without an account</h2>
      <p>You can generate activities without signing up. Your filter choices are kept in your browser tab, and favourites you save as a guest are stored only in your browser&apos;s local storage on that device. We don&apos;t receive them.</p>
      <h2>With an account</h2>
      <ul>
        <li><strong>Account data:</strong> your email address and a securely hashed password, handled by our authentication provider, Supabase.</li>
        <li><strong>Profile:</strong> your username, optional display name and optional avatar URL.</li>
        <li><strong>Activity data:</strong> activities you complete (with timestamps and XP), favourites, votes, streaks and daily challenge completions. Your individual votes are private; only the totals for each activity are public.</li>
        <li><strong>Leaderboard:</strong> your username, display name, avatar, XP and level are public on the leaderboard unless you turn this off in settings. Your email is never shown.</li>
      </ul>
      <h2>Activity submissions</h2>
      <p>When you suggest an activity we store its content, your account ID and its review status. Every submission is reviewed by a moderator before it can be published.</p>
      <p>If you delete your account, we keep the submission&apos;s review record without your account link, and your votes are removed. Approved activities stay in the library without your name. [Operator: confirm retention periods.]</p>
      <h2>Cookies</h2>
      <p>We use essential cookies to keep you signed in. We don&apos;t use advertising cookies. This version of the site runs no third-party analytics.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile and leaderboard visibility in <Link href="/settings">settings</Link>.</li>
        <li>Delete your account at any time from settings.</li>
        <li>Contact us for a copy of your data or other requests: see the <Link href="/contact">contact page</Link>.</li>
      </ul>
      <h2>Service providers</h2>
      <p>Supabase (database and authentication) and our hosting provider [hosting provider, e.g. Vercel] process data on our behalf. [Operator: list data locations and legal bases for your jurisdiction.]</p>
    </ProsePage>
  );
}
