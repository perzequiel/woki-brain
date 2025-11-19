import { LockManager } from '../../../domain/interfaces/locks';

// Declare setTimeout/clearTimeout for TypeScript
declare const setTimeout: (callback: () => void, ms: number) => number;
declare const clearTimeout: (id: number) => void;

interface LockEntry {
  acquiredAt: Date;
  ttl: number;
  timeoutId?: number;
}

/**
 * In-memory implementation of LockManager.
 * Uses a Map for lock storage with TTL support.
 */
class InMemoryLockManager implements LockManager {
  private readonly locks: Map<string, LockEntry>;
  private readonly defaultTTL: number = 5000; // 5 seconds

  constructor() {
    this.locks = new Map();
  }

  /**
   * Acquires a lock for the given key.
   *
   * @param key - Lock key
   * @param ttl - Time to live in milliseconds (default: 5000)
   * @returns true if lock was acquired, false if already locked
   */
  public async acquire(key: string, ttl: number = this.defaultTTL): Promise<boolean> {
    // Clean expired locks first
    this.cleanExpiredLocks();

    // Check if lock already exists
    if (this.locks.has(key)) {
      return false; // Already locked
    }

    // Acquire lock
    const entry: LockEntry = {
      acquiredAt: new Date(),
      ttl,
    };

    // Set auto-expiration
    entry.timeoutId = setTimeout(() => {
      this.locks.delete(key);
    }, ttl);

    this.locks.set(key, entry);

    return true;
  }

  /**
   * Releases a lock for the given key.
   *
   * @param key - Lock key
   */
  public async release(key: string): Promise<void> {
    const entry = this.locks.get(key);
    if (entry) {
      // Clear timeout if exists
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      this.locks.delete(key);
    }
  }

  /**
   * Cleans expired locks.
   * Locks are considered expired if current time - acquiredAt > ttl.
   */
  private cleanExpiredLocks(): void {
    const now = Date.now();
    const entries = Array.from(this.locks.entries());
    for (const [key, entry] of entries) {
      const age = now - entry.acquiredAt.getTime();
      if (age > entry.ttl) {
        // Lock expired, remove it
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        this.locks.delete(key);
      }
    }
  }

  /**
   * Gets all active locks (for testing/debugging).
   *
   * @returns Array of lock keys
   */
  public getActiveLocks(): string[] {
    this.cleanExpiredLocks();
    return Array.from(this.locks.keys());
  }

  /**
   * Clears all locks (for testing).
   */
  public async clear(): Promise<void> {
    const entries = Array.from(this.locks.values());
    for (const entry of entries) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
    }
    this.locks.clear();
  }
}

export default InMemoryLockManager;
