/**
 * Lock Manager interface (port) for domain layer.
 * Implementation should be in infrastructure layer.
 */

export interface LockManager {
  /**
   * Acquires a lock for the given key.
   *
   * @param key - Lock key (e.g., "R1|S1|T2+T3|2025-10-22T20:00:00-03:00")
   * @param ttl - Time to live in milliseconds (default: 5000)
   * @returns true if lock was acquired, false if already locked
   */
  acquire(key: string, ttl?: number): Promise<boolean>;

  /**
   * Releases a lock for the given key.
   *
   * @param key - Lock key
   */
  release(key: string): Promise<void>;
}
