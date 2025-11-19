import Booking from '../entities/booking';
import Table from '../entities/table';
import { alignToGrid, alignToNextGrid, isValidDuration, timeStringToDate } from './time';

/**
 * Represents a time gap where a table (or combination) is available.
 * Intervals are [start, end) - end is exclusive.
 */
export interface TimeGap {
  start: Date;
  end: Date;
  durationMinutes: number;
}

/**
 * Input for gap discovery
 */
export interface GapDiscoveryInput {
  table: Table;
  bookings: Booking[]; // All bookings for the day
  date: string; // YYYY-MM-DD
  durationMinutes: number; // Required duration (multiple of 15)
  serviceWindows?: Array<{ start: string; end: string }>; // Optional: ["HH:mm", "HH:mm"]
  timezone: string; // IANA timezone (e.g., "America/Argentina/Buenos_Aires")
}

/**
 * Gap Discovery Service - Finds available time slots for tables.
 *
 * Algorithm (simple version):
 * 1. Filter CONFIRMED bookings for the table on the given date
 * 2. Sort bookings by start time
 * 3. Find gaps between bookings (and before/after)
 * 4. Filter gaps that are >= durationMinutes
 */
class GapDiscoveryService {
  /**
   * Finds available time gaps for a single table.
   *
   * @param input - Gap discovery input parameters
   * @returns Array of available time gaps (aligned to 15-minute grid)
   */
  public findGapsForTable(input: GapDiscoveryInput): TimeGap[] {
    const { table, bookings, date, durationMinutes, serviceWindows, timezone } = input;

    // Validate duration
    if (!isValidDuration(durationMinutes)) {
      throw new Error(
        `Invalid duration: ${durationMinutes}. Must be multiple of 15 minutes between 30-180.`
      );
    }

    // Step 1: Filter CONFIRMED bookings for this table on this date
    const tableBookings = this.filterTableBookings(bookings, table.id, date);

    // Step 2: Convert bookings to Date objects, align to grid, and sort by start time
    const sortedBookings = this.normalizeAndSortBookings(tableBookings);

    // Step 3: Get the day boundaries (start and end of day) - aligned to grid
    const dayStart = this.getDayStart(date, timezone);
    const dayEnd = this.getDayEnd(date, timezone);

    // Step 4: Find gaps (aligned to 15-minute grid)
    // If no bookings, the whole day is available
    if (sortedBookings.length === 0) {
      const fullDayGap = this.createGapAligned(dayStart, dayEnd);
      let gaps = this.filterByDuration([fullDayGap], durationMinutes);
      if (serviceWindows && serviceWindows.length > 0) {
        gaps = this.filterByServiceWindows(gaps, serviceWindows, date, timezone);
      }
      return gaps;
    }

    // Find gaps between bookings
    const gaps: TimeGap[] = [];

    // Gap before first booking
    const firstBookingStart = sortedBookings[0].start;
    if (firstBookingStart > dayStart) {
      gaps.push(this.createGapAligned(dayStart, firstBookingStart));
    }

    // Gaps between bookings
    for (let i = 0; i < sortedBookings.length - 1; i++) {
      const currentEnd = sortedBookings[i].end;
      const nextStart = sortedBookings[i + 1].start;

      // If bookings don't overlap (end exclusive, so equal is OK)
      if (currentEnd <= nextStart) {
        gaps.push(this.createGapAligned(currentEnd, nextStart));
      }
    }

    // Gap after last booking
    const lastBookingEnd = sortedBookings[sortedBookings.length - 1].end;
    if (lastBookingEnd < dayEnd) {
      gaps.push(this.createGapAligned(lastBookingEnd, dayEnd));
    }

    // Step 5: Filter by duration and service windows
    let validGaps = this.filterByDuration(gaps, durationMinutes);

    if (serviceWindows && serviceWindows.length > 0) {
      validGaps = this.filterByServiceWindows(validGaps, serviceWindows, date, timezone);
    }

    return validGaps;
  }

  /**
   * Filters bookings for a specific table on a specific date.
   */
  private filterTableBookings(bookings: Booking[], tableId: string, date: string): Booking[] {
    return bookings.filter((booking) => {
      // Only CONFIRMED bookings
      if (booking.status !== 'CONFIRMED') {
        return false;
      }

      // Check if table is in this booking
      if (!booking.tableIds.includes(tableId)) {
        return false;
      }

      // Check if booking is on the requested date
      const bookingDate = booking.start.split('T')[0]; // Extract YYYY-MM-DD
      return bookingDate === date;
    });
  }

  /**
   * Converts booking ISO strings to Date objects, aligns to grid, and sorts by start time.
   */
  private normalizeAndSortBookings(bookings: Booking[]): Array<{ start: Date; end: Date }> {
    return bookings
      .map((booking) => ({
        start: alignToGrid(new Date(booking.start)), // Align start to grid
        end: alignToGrid(new Date(booking.end)), // Align end to grid
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Gets the start of the day (00:00:00) aligned to grid.
   */
  private getDayStart(date: string, _timezone: string): Date {
    const dayStart = new Date(`${date}T00:00:00`);
    return alignToGrid(dayStart);
  }

  /**
   * Gets the end of the day (23:59:59) aligned to grid.
   * Rounds up to next grid slot.
   */
  private getDayEnd(date: string, _timezone: string): Date {
    const dayEnd = new Date(`${date}T23:59:59`);
    return alignToNextGrid(dayEnd);
  }

  /**
   * Creates a TimeGap from start and end dates, aligned to 15-minute grid.
   * Start is aligned down, end is aligned down (to ensure gap is within bounds).
   */
  private createGapAligned(start: Date, end: Date): TimeGap {
    const alignedStart = alignToGrid(new Date(start));
    const alignedEnd = alignToGrid(new Date(end));

    const durationMinutes = Math.floor(
      (alignedEnd.getTime() - alignedStart.getTime()) / (1000 * 60)
    );

    return {
      start: alignedStart,
      end: alignedEnd,
      durationMinutes,
    };
  }

  /**
   * Filters gaps that are at least the required duration.
   */
  private filterByDuration(gaps: TimeGap[], minDurationMinutes: number): TimeGap[] {
    return gaps.filter((gap) => gap.durationMinutes >= minDurationMinutes);
  }

  /**
   * Filters gaps to only include those that fit entirely within service windows.
   * A gap must be completely contained within at least one service window.
   *
   * @param gaps - Gaps to filter
   * @param serviceWindows - Array of service windows [{ start: "HH:mm", end: "HH:mm" }]
   * @param date - Date string (YYYY-MM-DD)
   * @param _timezone - Timezone (for future use)
   * @returns Gaps that fit within service windows
   */
  private filterByServiceWindows(
    gaps: TimeGap[],
    serviceWindows: Array<{ start: string; end: string }>,
    date: string,
    _timezone: string
  ): TimeGap[] {
    return gaps.filter((gap) => {
      // Check if gap fits within any service window
      return serviceWindows.some((window) => {
        const windowStart = timeStringToDate(date, window.start);
        const windowEnd = timeStringToDate(date, window.end);

        // Gap must be completely within the window
        // gap.start >= windowStart && gap.end <= windowEnd
        return gap.start >= windowStart && gap.end <= windowEnd;
      });
    });
  }
}

export default GapDiscoveryService;
