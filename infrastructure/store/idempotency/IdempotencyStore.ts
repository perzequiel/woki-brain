import Booking from '../../../domain/entities/booking';
import { IdempotencyStore } from '../../../domain/interfaces/idempotency';

// Declare setTimeout/clearTimeout for TypeScript
declare const setTimeout: (callback: () => void, ms: number) => number;
declare const clearTimeout: (id: number) => void;

interface IdempotencyEntry {
  booking: Booking;
  expiresAt: Date;
  timeoutId?: number;
}

/**
 * In-memory implementation of IdempotencyStore.
 * Stores idempotency key → booking mappings with TTL support.
 */
class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store: Map<string, IdempotencyEntry>;
  private readonly defaultTTL: number = 60000; // 60 seconds

  constructor() {
    this.store = new Map();
  }

  /**
   * Gets a booking by idempotency key.
   *
   * @param key - Idempotency key
   * @returns Booking if exists and not expired, null otherwise
   */
  public async get(key: string): Promise<Booking | null> {
    // Clean expired entries first
    this.cleanExpiredEntries();

    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.store.delete(key);
      return null;
    }

    return entry.booking;
  }

  /**
   * Stores a booking with idempotency key.
   *
   * @param key - Idempotency key
   * @param booking - Booking to store
   * @param ttl - Time to live in milliseconds (default: 60000)
   */
  public async set(key: string, booking: Booking, ttl: number = this.defaultTTL): Promise<void> {
    // Clean expired entries first
    this.cleanExpiredEntries();

    const expiresAt = new Date(Date.now() + ttl);

    const entry: IdempotencyEntry = {
      booking,
      expiresAt,
    };

    // Set auto-expiration
    entry.timeoutId = setTimeout(() => {
      this.store.delete(key);
    }, ttl);

    this.store.set(key, entry);
  }

  /**
   * Cleans expired entries.
   */
  private cleanExpiredEntries(): void {
    const now = new Date();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt < now) {
        // Entry expired, remove it
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        this.store.delete(key);
      }
    }
  }

  /**
   * Gets all active entries (for testing/debugging).
   *
   * @returns Array of idempotency keys
   */
  public getActiveKeys(): string[] {
    this.cleanExpiredEntries();
    return Array.from(this.store.keys());
  }

  /**
   * Clears all entries (for testing).
   */
  public async clear(): Promise<void> {
    const entries = Array.from(this.store.values());
    for (const entry of entries) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
    }
    this.store.clear();
  }
}

export default InMemoryIdempotencyStore;
