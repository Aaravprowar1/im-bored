/**
 * Small fixed-window rate limiter kept in memory. It is per server instance,
 * which is enough to blunt abuse of cheap endpoints. The paid submission flow
 * also has a database-enforced limit (create_submission) that holds across
 * instances. For stricter global limits, swap this for a shared store such as
 * Upstash Redis.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

export function clientKey(request: Request, userId?: string | null) {
  if (userId) return `u:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

export function resetRateLimits() {
  buckets.clear();
}
