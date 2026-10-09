import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";
import { Notice } from "@/components/ui/card";
import { publicConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Contact", description: "How to get in touch with im bored." };

export default function ContactPage() {
  const email = publicConfig.contactEmail;
  return (
    <ProsePage title="Contact">
      <p>Questions about an activity, a submission, a payment or your data? Get in touch and include your username and, for submissions, the submission title.</p>
      {email ? (
        <p>Email: <a href={`mailto:${email}`}>{email}</a></p>
      ) : (
        <Notice tone="warning" title="Contact details not configured">
          The site operator hasn&apos;t set a contact address yet. Set NEXT_PUBLIC_CONTACT_EMAIL to show one here.
        </Notice>
      )}
      <p>For problems with a specific activity in the generator, tell us its title and what&apos;s wrong. Unsafe activities are removed quickly.</p>
    </ProsePage>
  );
}
