/**
 * First-pass automated screen for submitted activities. It rejects ideas that
 * are obviously unsafe, illegal or harassing before anyone pays. It is not a
 * substitute for human moderation, which reviews every submission.
 */
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(trespass\w*|break(ing)? into|sneak into)\b/i, reason: "trespassing" },
  { pattern: /\b(steal\w*|shoplift\w*|pickpocket\w*)\b/i, reason: "theft" },
  { pattern: /\b(vandali[sz]\w*|graffiti on|spray[- ]?paint (a|someone|their|the) (wall|car|house))\b/i, reason: "vandalism" },
  { pattern: /\b(set (something|it|a) on fire|arson|light(ing)? a fire indoors|fireworks? indoors)\b/i, reason: "fire" },
  { pattern: /\b(prank call|harass\w*|bully\w*|stalk\w*|dox\w*|humiliat\w*)\b/i, reason: "harassment" },
  { pattern: /\b(follow (a )?stranger|photograph strangers without|film strangers without|secretly (film|record|photograph))\b/i, reason: "privacy" },
  { pattern: /\b(drunk|get high|drugs?|vape|binge drink\w*|shots? of)\b/i, reason: "substances" },
  { pattern: /\b(hold your breath until|choking game|blackout challenge|tide pod|eat (a )?(detergent|soap|cinnamon spoon))\b/i, reason: "dangerous challenge" },
  { pattern: /\b(jump off|climb (a |the )?(roof|tower|crane|bridge)|play in traffic|run across (the )?(road|highway))\b/i, reason: "dangerous stunt" },
  { pattern: /\b(knife|knives|gun|weapon|explosive)s?\b.*\b(throw|juggle|play|challenge)\b/i, reason: "weapons" },
  { pattern: /\b(self[- ]?harm|hurt yourself|starve yourself)\b/i, reason: "self-harm" },
  { pattern: /\b(gambl\w*|bet (money|real money)|buy crypto)\b/i, reason: "pressure to spend money" },
  { pattern: /https?:\/\/|www\./i, reason: "links aren't allowed" },
];

export function screenSubmission(text: string): { ok: true } | { ok: false; reason: string } {
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason };
  }
  return { ok: true };
}
