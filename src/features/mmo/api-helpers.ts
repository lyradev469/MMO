// ============================================================
// ChainQuest MMO - API Helper Utilities
// ============================================================

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Rate limit map: token → last call timestamp
 * Simple in-memory rate limiter for agent API calls
 */
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 200; // 5 calls/second max per token

export function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(token) ?? 0;
  if (now - last < RATE_LIMIT_MS) return false;
  rateLimitMap.set(token, now);
  return true;
}
