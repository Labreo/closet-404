const WINDOW_MS = 10 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function hit(key: string, limit: number, now: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** In-memory limiter: `perIp` requests per IP and `global` across all callers, per 10 minutes. */
export function allowRequest(
  scope: string,
  ip: string,
  perIp: number,
  global: number
): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  return hit(`${scope}:global`, global, now) && hit(`${scope}:${ip}`, perIp, now);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'local'
  );
}

export const RATE_LIMIT_MESSAGE =
  'The candles are guttering: too many séances right now. Try again in a few minutes, or run Closet 404 on your own machine with Ollama and Gemma for unlimited séances.';
