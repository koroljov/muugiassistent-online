// Lihtne mälupõhine kiiruspiir (per kasutaja). Kaitseb kuluründe ja tsükli eest.
// NB: serverless-keskkonnas kehtib see warm-instance kohta, mitte globaalselt — piisav sisemise tööriista jaoks.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
