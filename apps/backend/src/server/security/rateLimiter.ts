interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetAt) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Prevent interval from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Checks if an identifier exceeds the rate limit.
   * @param key Unique identifier (e.g. IP + endpoint, or email + endpoint)
   * @param maxRequests Maximum allowed requests in the window
   * @param windowMs Time window in milliseconds
   */
  public isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return false;
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * Resets limit for a specific key (e.g. upon successful login)
   */
  public reset(key: string): void {
    this.store.delete(key);
  }
}

export const rateLimiter = new InMemoryRateLimiter();
