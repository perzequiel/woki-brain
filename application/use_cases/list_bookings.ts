import { BookingRepository } from '../../domain/interfaces/repositories';

/**
 * Input for List Bookings use case
 */
export interface ListBookingsInput {
  restaurantId: string;
  sectorId?: string; // Optional: filter by sector
  date: string; // YYYY-MM-DD
}

/**
 * Booking item in response
 */
export interface BookingItem {
  id: string;
  tableIds: string[];
  partySize: number;
  start: string; // ISO8601
  end: string; // ISO8601
  status: 'CONFIRMED' | 'CANCELLED';
}

/**
 * Response from List Bookings use case
 */
export interface ListBookingsResponse {
  date: string;
  items: BookingItem[];
}

/**
 * List Bookings Use Case
 *
 * Retrieves all bookings for a restaurant on a specific date.
 * Optionally filters by sector.
 */
class ListBookingsUseCase {
  private readonly bookingRepo: BookingRepository;

  constructor(bookingRepo: BookingRepository) {
    this.bookingRepo = bookingRepo;
  }

  /**
   * Lists bookings for a restaurant on a specific date.
   *
   * @param input - List bookings input parameters
   * @returns ListBookingsResponse with bookings
   */
  public async execute(input: ListBookingsInput): Promise<ListBookingsResponse> {
    const { restaurantId, sectorId, date } = input;

    // Get all bookings for the restaurant on the date
    const bookings = await this.bookingRepo.findByRestaurantAndDate(restaurantId, date);

    // Filter by sector if provided
    const filteredBookings = sectorId
      ? bookings.filter((booking) => booking.sectorId === sectorId)
      : bookings;

    // Convert to response format
    const items: BookingItem[] = filteredBookings.map((booking) => ({
      id: booking.id,
      tableIds: booking.tableIds,
      partySize: booking.partySize,
      start: booking.start,
      end: booking.end,
      status: booking.status,
    }));

    return {
      date,
      items,
    };
  }
}

export default ListBookingsUseCase;
