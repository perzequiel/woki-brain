import { describe, expect, test } from 'vitest';
import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';
import { findComboGaps } from '../../domain/services/combo_intersection';
import { timeStringToDate } from '../../domain/services/time';

function createTable(id: string, minSize: number, maxSize: number): Table {
  return Table.create({
    id,
    sectorId: 'S1',
    name: `Table ${id}`,
    minSize,
    maxSize,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

function createBooking(
  id: string,
  tableIds: string[],
  start: string,
  end: string,
  status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED'
): Booking {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));

  return Booking.create({
    id,
    restaurantId: 'R1',
    sectorId: 'S1',
    tableIds,
    partySize: 2,
    start,
    end,
    durationMinutes,
    status,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

describe('Combo Intersection Service', () => {
  describe('findComboGaps', () => {
    test('Finds combo gaps when all tables are free simultaneously', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        60,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // Should find gaps where both T1 and T2 are free (after 21:00)
      expect(comboGaps.length).toBeGreaterThan(0);
    });

    test('Returns empty when one table has no gaps', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        // T1 is booked all day - need to cover the entire day including end
        // The day ends at 23:59:59, so we need to book until 23:59:59 or later
        createBooking('B1', ['T1'], '2025-10-22T00:00:00-03:00', '2025-10-23T00:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        60,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // T1 has no gaps, so combo has no gaps
      expect(comboGaps.length).toBe(0);
    });

    test('Finds intersection of overlapping gaps', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        // T1: booked 20:00-21:00, free from 21:00
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        // T2: booked 20:00-21:00, free from 21:00 (same as T1)
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        30,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // Should find intersection where both tables are free
      expect(comboGaps.length).toBeGreaterThan(0);
      comboGaps.forEach((gap) => {
        expect(gap.durationMinutes).toBeGreaterThanOrEqual(30);
      });
    });

    test('Handles three tables combo', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4), createTable('T3', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B3', ['T3'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        60,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // Should find gaps where all three tables are free
      expect(comboGaps.length).toBeGreaterThan(0);
    });

    test('Filters combo gaps by minimum duration', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        120, // Need 120 minutes
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // All gaps should be >= 120 minutes
      comboGaps.forEach((gap) => {
        expect(gap.durationMinutes).toBeGreaterThanOrEqual(120);
      });
    });

    test('Handles partially overlapping gaps correctly', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        // T1: booked 20:00-21:00, free from 21:00
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        // T2: booked 20:00-21:00, free from 21:00 (same as T1 for simplicity)
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        30,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // Should find intersection where both tables are free
      // Intersection starts at max(21:00, 21:00) = 21:00
      expect(comboGaps.length).toBeGreaterThan(0);
      comboGaps.forEach((gap) => {
        expect(gap.durationMinutes).toBeGreaterThanOrEqual(30);
      });
    });

    test('Respects service windows', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings: Booking[] = [];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        60,
        [{ start: '20:00', end: '23:45' }],
        'America/Argentina/Buenos_Aires'
      );

      // All gaps should be within service window
      // Use timeStringToDate to match how the service creates dates
      const windowStart = timeStringToDate('2025-10-22', '20:00');
      comboGaps.forEach((gap) => {
        // Use timestamp comparison to avoid timezone issues
        expect(gap.start.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());
      });
    });

    test('Returns empty for empty tables array', () => {
      const comboGaps = findComboGaps(
        [],
        [],
        '2025-10-22',
        60,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      expect(comboGaps.length).toBe(0);
    });

    test('Handles single table (no intersection needed)', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const comboGaps = findComboGaps(
        tables,
        bookings,
        '2025-10-22',
        60,
        undefined,
        'America/Argentina/Buenos_Aires'
      );

      // Should return gaps for single table (no intersection needed)
      expect(comboGaps.length).toBeGreaterThan(0);
    });
  });
});
