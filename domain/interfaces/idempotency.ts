import Booking from '../entities/booking';

/**
 * Idempotency Store interface (port) for domain layer.
 * Implementation should be in infrastructure layer.
 */

export interface IdempotencyStore {
  /**
   * Gets a booking by idempotency key.
   *
   * @param key - Idempotency key
   * @returns Booking if exists, null otherwise
   */
  get(key: string): Promise<Booking | null>;

  /**
   * Stores a booking with idempotency key.
   *
   * @param key - Idempotency key
   * @param booking - Booking to store
   * @param ttl - Time to live in milliseconds (default: 60000)
   */
  set(key: string, booking: Booking, ttl?: number): Promise<void>;
}
