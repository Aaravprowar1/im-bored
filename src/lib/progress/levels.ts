/** Level rule: every 100 cumulative XP advances one level. Level 1 starts at 0 XP. */
export const XP_PER_LEVEL = 100;

export function levelForXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp % XP_PER_LEVEL;
  return { level, intoLevel, toNext: XP_PER_LEVEL - intoLevel, progress: intoLevel / XP_PER_LEVEL };
}

/**
 * The stored streak only changes when the user completes something. When
 * reading it, a streak whose last active UTC day is before yesterday is over.
 */
export function effectiveStreak(currentStreak: number, lastActiveDate: string | null, todayUtc: string): number {
  if (!lastActiveDate) return 0;
  const last = Date.parse(`${lastActiveDate}T00:00:00Z`);
  const today = Date.parse(`${todayUtc}T00:00:00Z`);
  const days = Math.round((today - last) / 86_400_000);
  return days <= 1 ? currentStreak : 0;
}

export interface UserProgress {
  total_xp: number;
  activities_completed: number;
  daily_challenges_completed: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}
