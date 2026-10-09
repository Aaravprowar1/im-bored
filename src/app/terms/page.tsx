import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Terms", description: "Terms of use for im bored., including activity submissions." };

export default function TermsPage() {
  return (
    <ProsePage title="Terms" updated="[date]" draft>
      <p>These terms apply to im bored., operated by {OPERATOR}. By using the site you agree to them.</p>
      <h2>Using activities</h2>
      <p>Activities are suggestions for fun. Use common sense, follow any safety notes, respect other people and their property, and skip anything that isn&apos;t right for you. You are responsible for how you take part.</p>
      <h2>Accounts</h2>
      <p>Keep your login details safe. Usernames must not impersonate others or be offensive. We may suspend accounts that abuse the site, for example by gaming the leaderboard.</p>
      <h2 id="submissions">Activity submissions and the $1 fee</h2>
      <ul>
        <li>Submitting an activity for review costs <strong>$1.00 USD</strong> per submission, charged in US dollars through Stripe. Your bank may convert the amount and charge its own fees.</li>
        <li>The fee pays for a moderator to review your submission. <strong>It does not guarantee approval, publication, a number of views or any other outcome.</strong></li>
        <li>Every submission is reviewed before publication. A moderator may approve it, reject it, or ask you for changes. Edits after a change request don&apos;t cost extra.</li>
        <li>Submissions must be your own idea, safe, legal and kind. No dangerous stunts, trespassing, vandalism, harassment, privacy violations, links or advertising.</li>
        <li>By submitting, you give us a non-exclusive, worldwide, royalty-free licence to edit lightly, publish and display your activity on im bored. [Operator: confirm licence terms.]</li>
        <li>We may archive a published activity later if a problem is reported.</li>
      </ul>
      <h2>Refunds</h2>
      <p>[Operator: set and review your refund policy.] Suggested starting point: if a payment is taken but the submission is never reviewed, or if it is rejected, an administrator may refund the fee through Stripe. Refunds are shown on your submission&apos;s status page as &ldquo;Refund pending&rdquo; and then &ldquo;Refunded&rdquo;. Nothing in these terms limits any rights you have under consumer law.</p>
      <h2>Changes and contact</h2>
      <p>We may update these terms and will change the date above when we do. Questions? See the <Link href="/contact">contact page</Link>.</p>
      <p>[Operator: governing law and jurisdiction.]</p>
    </ProsePage>
  );
}
