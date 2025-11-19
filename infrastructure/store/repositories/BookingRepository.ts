import Booking from '../../../domain/entities/booking';
import { BookingRepository } from '../../../domain/interfaces/repositories';

/**
 * In-memory implementation of BookingRepository.
 * Uses a Map for storage, keyed by booking ID.
 */
class InMemoryBookingRepository implements BookingRepository {
  private readonly store: Map<string, Booking>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Finds a booking by ID.
   *
   * @param id - Booking ID
   * @returns Booking if found, null otherwise
   */
  public async findById(id: string): Promise<Booking | null> {
    return Promise.resolve(this.store.get(id) || null);
  }

  /**
   * Finds all bookings for a restaurant on a specific date.
   * Filters by restaurant ID and date (YYYY-MM-DD).
   *
   * @param restaurantId - Restaurant ID
   * @param date - Date string (YYYY-MM-DD)
   * @returns Array of bookings for that restaurant on that date
   */
  public async findByRestaurantAndDate(restaurantId: string, date: string): Promise<Booking[]> {
    return Promise.resolve(
      Array.from(this.store.values()).filter((booking) => {
        if (booking.restaurantId !== restaurantId) {
          return false;
        }

        // Extract date from ISO8601 string (YYYY-MM-DD)
        const bookingDate = booking.start.split('T')[0];
        return bookingDate === date;
      })
    );
  }

  /**
   * Finds all bookings for specific tables on a specific date.
   * Used for collision detection.
   *
   * @param tableIds - Array of table IDs
   * @param date - Date string (YYYY-MM-DD)
   * @returns Array of bookings that use any of the specified tables on that date
   */
  public async findByTableAndDate(tableIds: string[], date: string): Promise<Booking[]> {
    return Promise.resolve(
      Array.from(this.store.values()).filter((booking) => {
        // Extract date from ISO8601 string
        const bookingDate = booking.start.split('T')[0];
        if (bookingDate !== date) {
          return false;
        }

        // Check if booking uses any of the specified tables
        return booking.tableIds.some((id) => tableIds.includes(id));
      })
    );
  }

  /**
   * Saves a booking.
   *
   * @param booking - Booking to save
   * @returns Saved booking
   */
  public async save(booking: Booking): Promise<Booking> {
    this.store.set(booking.id, booking);
    return Promise.resolve(booking);
  }

  /**
   * Gets all bookings (for testing/debugging).
   *
   * @returns Array of all bookings
   */
  public async findAll(): Promise<Booking[]> {
    return Promise.resolve(Array.from(this.store.values()));
  }

  /**
   * Clears all bookings (for testing).
   */
  public async clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}

export default InMemoryBookingRepository;
