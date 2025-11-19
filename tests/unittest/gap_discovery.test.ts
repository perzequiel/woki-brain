import { describe, expect, test } from 'vitest';
import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';
import { findComboGaps } from '../../domain/services/combo_intersection';
import GapDiscoveryService from '../../domain/services/gap_discovery';

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

describe('Gap Discovery Service', () => {
  const service = new GapDiscoveryService();

  describe('Basic Gap Discovery', () => {
    test('Finds gap when no bookings exist', () => {
      const table = createTable('T1', 2, 4);
      const gaps = service.findGapsForTable({
        table,
        bookings: [],
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(gaps.length).toBeGreaterThan(0);
      expect(gaps[0].durationMinutes).toBeGreaterThanOrEqual(60);
    });

    test('Finds gap between two bookings', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B2', ['T1'], '2025-10-22T22:00:00-03:00', '2025-10-22T23:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gap from 21:00 to 22:00
      expect(gaps.length).toBeGreaterThan(0);
      const gap = gaps.find((g) => {
        const startHour = g.start.getHours();
        return startHour === 21;
      });
      expect(gap).toBeDefined();
      expect(gap!.durationMinutes).toBeGreaterThanOrEqual(60);
    });

    test('Finds gap before first booking', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gap before 20:00
      expect(gaps.length).toBeGreaterThan(0);
    });

    test('Finds gap after last booking', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gap after 21:00
      expect(gaps.length).toBeGreaterThan(0);
    });

    test('Filters gaps by minimum duration', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T20:30:00-03:00'),
        createBooking('B2', ['T1'], '2025-10-22T20:45:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60, // Need 60 minutes
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Gap between bookings is only 15 minutes, should be filtered out
      // But gap before or after might be >= 60
      gaps.forEach((gap) => {
        expect(gap.durationMinutes).toBeGreaterThanOrEqual(60);
      });
    });
  });

  describe('15-Minute Grid Alignment', () => {
    test('Aligns gaps to 15-minute grid', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:07:00-03:00', '2025-10-22T21:23:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      gaps.forEach((gap) => {
        // Check that minutes are aligned to grid (0, 15, 30, 45)
        const startMinutes = gap.start.getMinutes();
        const endMinutes = gap.end.getMinutes();
        expect([0, 15, 30, 45]).toContain(startMinutes);
        expect([0, 15, 30, 45]).toContain(endMinutes);
        expect(gap.start.getSeconds()).toBe(0);
        expect(gap.end.getSeconds()).toBe(0);
      });
    });
  });

  describe('Service Windows', () => {
    test('Filters gaps within service windows', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        serviceWindows: [{ start: '20:00', end: '23:45' }],
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // All gaps should be within service window
      gaps.forEach((gap) => {
        const gapStartHour = gap.start.getHours();
        const gapStartMin = gap.start.getMinutes();
        const gapEndHour = gap.end.getHours();
        const gapEndMin = gap.end.getMinutes();

        // Gap should start at or after 20:00
        expect(gapStartHour).toBeGreaterThanOrEqual(20);
        if (gapStartHour === 20) {
          expect(gapStartMin).toBeGreaterThanOrEqual(0);
        }

        // Gap should end at or before 23:45
        expect(gapEndHour).toBeLessThanOrEqual(23);
        if (gapEndHour === 23) {
          expect(gapEndMin).toBeLessThanOrEqual(45);
        }
      });
    });

    test('Excludes gaps outside service windows', () => {
      const table = createTable('T1', 2, 4);
      const bookings: Booking[] = [];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        serviceWindows: [{ start: '20:00', end: '23:45' }],
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should only return gaps within the service window
      gaps.forEach((gap) => {
        const gapStartHour = gap.start.getHours();
        expect(gapStartHour).toBeGreaterThanOrEqual(20);
      });
    });
  });

  describe('Edge Cases', () => {
    test('Handles bookings that touch (end exclusive)', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
        createBooking('B2', ['T1'], '2025-10-22T21:00:00-03:00', '2025-10-22T22:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should not find gap between bookings (they touch, end exclusive)
      // But should find gaps before/after
      expect(gaps.length).toBeGreaterThan(0);
    });

    test('Ignores CANCELLED bookings', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking(
          'B1',
          ['T1'],
          '2025-10-22T20:00:00-03:00',
          '2025-10-22T21:00:00-03:00',
          'CANCELLED'
        ),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gap as if no bookings exist (CANCELLED is ignored)
      expect(gaps.length).toBeGreaterThan(0);
    });

    test('Only considers bookings for the specific table', () => {
      const table = createTable('T1', 2, 4);
      const bookings = [
        createBooking('B1', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const gaps = service.findGapsForTable({
        table,
        bookings,
        date: '2025-10-22',
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gap as if no bookings exist (booking is for T2, not T1)
      expect(gaps.length).toBeGreaterThan(0);
    });

    test('Validates duration is multiple of 15', () => {
      const table = createTable('T1', 2, 4);

      expect(() => {
        service.findGapsForTable({
          table,
          bookings: [],
          date: '2025-10-22',
          durationMinutes: 25, // Not multiple of 15
          timezone: 'America/Argentina/Buenos_Aires',
        });
      }).toThrow('Invalid duration');
    });

    test('Validates duration is within range', () => {
      const table = createTable('T1', 2, 4);

      expect(() => {
        service.findGapsForTable({
          table,
          bookings: [],
          date: '2025-10-22',
          durationMinutes: 200, // > 180
          timezone: 'America/Argentina/Buenos_Aires',
        });
      }).toThrow('Invalid duration');
    });
  });

  describe('Combo Gap Intersection', () => {
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
        // T1 is booked all day
        createBooking('B1', ['T1'], '2025-10-22T00:00:00-03:00', '2025-10-22T23:59:00-03:00'),
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

      // First verify individual tables have gaps
      const service = new GapDiscoveryService();
      const t1Gaps = service.findGapsForTable({
        table: tables[0],
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        timezone: 'America/Argentina/Buenos_Aires',
      });
      const t2Gaps = service.findGapsForTable({
        table: tables[1],
        bookings,
        date: '2025-10-22',
        durationMinutes: 30,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Both tables should have gaps after 21:00
      expect(t1Gaps.length).toBeGreaterThan(0);
      expect(t2Gaps.length).toBeGreaterThan(0);

      // Now test combo intersection
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
  });
});
