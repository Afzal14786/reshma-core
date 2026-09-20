// ──────────────────────────────────────────────
// In-memory Redis mock
// Implements the subset of the redis client API used by Reshma-Core services.
// Supports TTL, expiry, and INCR semantics for OTP/blacklist/coupon logic.
// ──────────────────────────────────────────────

interface StoredValue {
  value: string;
  expiresAt: number | null;
}

class InMemoryRedisMock {
  private store = new Map<string, StoredValue>();

  private isExpired(entry: StoredValue): boolean {
    return entry.expiresAt !== null && entry.expiresAt < Date.now();
  }

  private getEntry(key: string): StoredValue | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  get = jest.fn(async (key: string): Promise<string | null> => {
    return this.getEntry(key)?.value ?? null;
  });

  set = jest.fn(
    async (
      key: string,
      value: string,
      ..._args: unknown[]
    ): Promise<string> => {
      this.store.set(key, { value, expiresAt: null });
      return "OK";
    },
  );

  setEx = jest.fn(
    async (key: string, ttlSeconds: number, value: string): Promise<string> => {
      this.store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return "OK";
    },
  );

  del = jest.fn(async (key: string | string[]): Promise<number> => {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  });

  incr = jest.fn(async (key: string): Promise<number> => {
    const entry = this.getEntry(key);
    const current = entry ? parseInt(entry.value, 10) : 0;
    const next = current + 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  });

  expire = jest.fn(async (key: string, ttlSeconds: number): Promise<number> => {
    const entry = this.getEntry(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  });

  ttl = jest.fn(async (key: string): Promise<number> => {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  });

  flushdb = jest.fn(async (): Promise<string> => {
    this.store.clear();
    return "OK";
  });

  quit = jest.fn(async (): Promise<string> => {
    this.store.clear();
    return "OK";
  });

  isOpen = true;

  /** Test helper — wipes state between test cases */
  _reset(): void {
    this.store.clear();
    this.get.mockClear();
    this.set.mockClear();
    this.setEx.mockClear();
    this.del.mockClear();
    this.incr.mockClear();
    this.expire.mockClear();
    this.ttl.mockClear();
    this.flushdb.mockClear();
    this.quit.mockClear();
  }

  /** Test helper — inspect raw store */
  _peek(key: string): string | undefined {
    return this.getEntry(key)?.value;
  }
}

export const redisMock = new InMemoryRedisMock();