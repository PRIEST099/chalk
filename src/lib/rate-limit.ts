import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(request: Request, route: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const key = `${route}:${clientIp(request)}`;
  const previous = buckets.get(key);
  const bucket = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + windowMs } : previous;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 2_000) for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  if (bucket.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  return NextResponse.json({ error: "Chalk is receiving requests a little too quickly. Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
