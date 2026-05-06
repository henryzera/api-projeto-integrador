import { RequestHandler } from 'express';

type RateLimiterOptions = {
  limit: number;
  message: string;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const hits = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';

    for (const [entryKey, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(entryKey);
      }
    }

    const current = hits.get(key);

    if (!current) {
      hits.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });

      return next();
    }

    current.count += 1;

    if (current.count > options.limit) {
      return res.status(429).json({ message: options.message });
    }

    return next();
  };
}
