export interface AttemptLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
}

/** Fixed-window attempt counter keyed by an arbitrary string (IP, email). In-process, per instance. */
export interface AttemptLimiter {
  /** Counts one attempt; returns 0 when allowed, else the seconds until the window resets. */
  hit(key: string): number;
}

export function createAttemptLimiter({ maxAttempts, windowMs, now = Date.now }: AttemptLimiterOptions): AttemptLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key) {
      const t = now();
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      return w.count > maxAttempts ? Math.max(1, Math.ceil((w.resetAt - t) / 1000)) : 0;
    },
  };
}
