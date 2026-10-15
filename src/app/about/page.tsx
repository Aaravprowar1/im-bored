import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "About", description: "Why im bored. exists and how it works." };

export default function AboutPage() {
  return (
    <ProsePage title="About">
      <p>We all open our phones out of boredom, then scroll for twenty minutes without finding anything to actually do. <strong>im bored.</strong> is the opposite: one button, one small thing to do right now.</p>
      <h2>How it works</h2>
      <ul>
        <li>Tell us how much time you have, where you are, how much energy you&apos;ve got and whether you want to spend money. Or don&apos;t; the defaults are wide open.</li>
        <li>Press the button. You get one random activity that fits.</li>
        <li>Turn on Chaos Mode for stranger (still harmless) ideas.</li>
        <li>Make an account if you want to earn XP, keep a streak, save favourites and appear on the <Link href="/leaderboard">leaderboard</Link>.</li>
      </ul>
      <h2>Where activities come from</h2>
      <p>Our starting library was written by hand. Anyone with an account can <Link href="/submit">suggest an activity</Link> for free. A moderator reads every submission and only safe, kind, original ideas are published. Everyone can then vote activities up or down, and the best-loved ones come up more often.</p>
      <h2>What we won&apos;t do</h2>
      <p>No dangerous dares, no pranks at someone else&apos;s expense, no pressure to buy anything, and no invasive tracking.</p>
    </ProsePage>
  );
}
