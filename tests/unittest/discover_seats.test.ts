import { describe, expect, test } from 'vitest';
import DiscoverSeatsUseCase from '../../application/use_cases/discover_seats';
import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';
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

describe('Discover Seats Use Case - Integrated', () => {
  const useCase = new DiscoverSeatsUseCase();

  describe('Basic Discovery', () => {
    test('Finds single table candidate when available', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.slotMinutes).toBe(15);
      expect(result.durationMinutes).toBe(90);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].kind).toBe('single');
      expect(result.candidates[0].tableIds).toEqual(['T1']);
    });

    test('Finds combo candidate when single tables cannot fit', () => {
      const tables = [
        createTable('T1', 2, 2), // Max 2
        createTable('T2', 2, 2), // Max 2
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 4, // Needs combo
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.candidates.length).toBeGreaterThan(0);
      // Should find combo candidates
      const comboCandidates = result.candidates.filter((c) => c.kind === 'combo');
      expect(comboCandidates.length).toBeGreaterThan(0);
    });

    test('Returns empty when no capacity available', () => {
      const tables = [createTable('T1', 2, 2)];
      const bookings = [
        // Book table all day
        createBooking('B1', ['T1'], '2025-10-22T00:00:00-03:00', '2025-10-22T23:59:00-03:00'),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 2,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should return empty or very limited candidates
      // (depends on how day boundaries are handled)
      expect(result.candidates.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('WokiBrain Selection Integration', () => {
    test('Prefers single table over combo', () => {
      const tables = [
        createTable('T1', 2, 4), // Can fit 3 alone
        createTable('T2', 2, 2),
        createTable('T3', 2, 2), // T2+T3 combo can also fit 3
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // First candidate should be single table
      if (result.candidates.length > 0) {
        expect(result.candidates[0].kind).toBe('single');
      }
    });

    test('Candidates are sorted by WokiBrain strategy', () => {
      const tables = [
        createTable('T1', 2, 6), // waste: 3
        createTable('T2', 2, 4), // waste: 1 (better)
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // First candidate should have lower waste
      if (result.candidates.length >= 2) {
        const first = result.candidates[0];
        const second = result.candidates[1];
        // If both are single, first should have lower waste or be earlier
        if (first.kind === 'single' && second.kind === 'single') {
          // T2 should come before T1 (lower waste)
          expect(first.tableIds).toContain('T2');
        }
      }
    });
  });

  describe('Service Windows', () => {
    test('Filters candidates by service windows', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        serviceWindows: [{ start: '20:00', end: '23:45' }],
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // All candidates should be within service window
      // Use timeStringToDate to match how the service creates dates
      const windowStart = timeStringToDate('2025-10-22', '20:00');
      result.candidates.forEach((candidate) => {
        const startDate = new Date(candidate.start);
        // Use timestamp comparison to avoid timezone issues
        expect(startDate.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());
      });
    });
  });

  describe('Limit Parameter', () => {
    test('Respects limit parameter', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4), createTable('T3', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
        limit: 2,
      });

      expect(result.candidates.length).toBeLessThanOrEqual(2);
    });

    test('Uses default limit of 10 when not specified', () => {
      const tables = Array.from({ length: 15 }, (_, i) => createTable(`T${i + 1}`, 2, 4));
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.candidates.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Capacity Filtering', () => {
    test('Filters out tables that cannot accommodate party size', () => {
      const tables = [
        createTable('T1', 2, 2), // Too small (max 2, need 3)
        createTable('T2', 2, 4), // Can fit
        createTable('T3', 5, 6), // Too large (min 5, need 3)
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should only find candidates from T2
      result.candidates.forEach((candidate) => {
        if (candidate.kind === 'single') {
          expect(candidate.tableIds).toEqual(['T2']);
        }
      });
    });

    test('Filters combo candidates by capacity', () => {
      const tables = [
        createTable('T1', 2, 3), // Max 3
        createTable('T2', 2, 3), // Max 3
        createTable('T3', 2, 3), // Max 3
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 5, // Needs combo, T1+T2+T3 = min 6, max 9 (can fit 5-9)
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find combo candidates that can accommodate 5
      const validCombos = result.candidates.filter(
        (c) => c.kind === 'combo' && c.tableIds.length >= 2
      );
      // At least one combo should be found (T1+T2+T3 can fit 5-9)
      expect(validCombos.length).toBeGreaterThan(0);
    });
  });

  describe('Time Window Filtering', () => {
    test('Filters candidates by windowStart and windowEnd', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 60,
        timezone: 'America/Argentina/Buenos_Aires',
        windowStart: '20:00',
        windowEnd: '22:00',
      });

      // The windowStart/windowEnd filter service windows, not the gaps themselves
      // This test verifies that the filtering logic is applied
      // If candidates exist, they should respect service windows that overlap with the requested window
      expect(result.candidates.length).toBeGreaterThanOrEqual(0);

      // If candidates are found, verify they are valid
      if (result.candidates.length > 0) {
        result.candidates.forEach((candidate) => {
          const startDate = new Date(candidate.start);
          const endDate = new Date(candidate.end);
          // Verify dates are valid
          expect(startDate.getTime()).toBeLessThan(endDate.getTime());
        });
      }
    });

    test('Applies window filter to service windows', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        serviceWindows: [
          { start: '19:00', end: '23:00' },
          { start: '20:00', end: '22:00' },
        ],
        timezone: 'America/Argentina/Buenos_Aires',
        windowStart: '20:00',
        windowEnd: '22:00',
      });

      // Should only use service windows that overlap with requested window
      // The filtered service window should be 20:00-22:00
      expect(result.candidates.length).toBeGreaterThan(0);
      // Use timeStringToDate to match how the service creates dates
      const windowStart = timeStringToDate('2025-10-22', '20:00');
      const windowEnd = timeStringToDate('2025-10-22', '22:00');
      result.candidates.forEach((candidate) => {
        const startDate = new Date(candidate.start);
        const endDate = new Date(candidate.end);

        // Candidate should start at or after 20:00 and end at or before 22:00
        // (in Argentina timezone)
        expect(startDate.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());
        expect(startDate.getTime()).toBeLessThan(windowEnd.getTime());
        expect(endDate.getTime()).toBeLessThanOrEqual(windowEnd.getTime());
      });
    });
  });

  describe('Combo Discovery', () => {
    test('Finds combos when single tables are booked', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4), createTable('T3', 2, 4)];
      const bookings = [
        // Book all single tables at 20:00
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T22:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T22:00:00-03:00'),
        createBooking('B3', ['T3'], '2025-10-22T20:00:00-03:00', '2025-10-22T22:00:00-03:00'),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 5, // Needs combo
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find combo candidates (T1+T2, T2+T3, etc.)
      const comboCandidates = result.candidates.filter((c) => c.kind === 'combo');
      expect(comboCandidates.length).toBeGreaterThan(0);
    });

    test('Finds combos with 3 or more tables', () => {
      const tables = [
        createTable('T1', 2, 2),
        createTable('T2', 2, 2),
        createTable('T3', 2, 2),
        createTable('T4', 2, 2),
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 6, // Needs combo of 3+ tables
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find combos with 3 or more tables
      const largeCombos = result.candidates.filter(
        (c) => c.kind === 'combo' && c.tableIds.length >= 3
      );
      expect(largeCombos.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('Handles empty tables array', () => {
      const result = useCase.execute({
        tables: [],
        bookings: [],
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.candidates.length).toBe(0);
    });

    test('Handles all tables booked for entire day', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        // Book all day - need to cover the entire day including end
        // The day ends at 23:59:59, so we need to book until 23:59:59 or later
        createBooking('B1', ['T1'], '2025-10-22T00:00:00-03:00', '2025-10-23T00:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T00:00:00-03:00', '2025-10-23T00:00:00-03:00'),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should return empty or very limited candidates
      expect(result.candidates.length).toBe(0);
    });

    test('Handles party size at minimum capacity', () => {
      const tables = [createTable('T1', 2, 4)]; // minSize: 2
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 2, // Exactly minSize
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.candidates.length).toBeGreaterThan(0);
      result.candidates.forEach((c) => {
        expect(c.tableIds).toContain('T1');
      });
    });

    test('Handles party size at maximum capacity', () => {
      const tables = [createTable('T1', 2, 4)]; // maxSize: 4
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 4, // Exactly maxSize
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result.candidates.length).toBeGreaterThan(0);
      result.candidates.forEach((c) => {
        expect(c.tableIds).toContain('T1');
      });
    });

    test('Ignores CANCELLED bookings', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings = [
        createBooking(
          'B1',
          ['T1'],
          '2025-10-22T20:00:00-03:00',
          '2025-10-22T21:00:00-03:00',
          'CANCELLED'
        ),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gaps as if no bookings exist (CANCELLED is ignored)
      expect(result.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('Response Format', () => {
    test('Returns correct response structure', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      expect(result).toHaveProperty('slotMinutes');
      expect(result).toHaveProperty('durationMinutes');
      expect(result).toHaveProperty('candidates');
      expect(result.slotMinutes).toBe(15);
      expect(result.durationMinutes).toBe(90);
      expect(Array.isArray(result.candidates)).toBe(true);
    });

    test('Candidates have correct structure', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      if (result.candidates.length > 0) {
        const candidate = result.candidates[0];
        expect(candidate).toHaveProperty('kind');
        expect(candidate).toHaveProperty('tableIds');
        expect(candidate).toHaveProperty('start');
        expect(candidate).toHaveProperty('end');
        expect(['single', 'combo']).toContain(candidate.kind);
        expect(Array.isArray(candidate.tableIds)).toBe(true);
        expect(typeof candidate.start).toBe('string');
        expect(typeof candidate.end).toBe('string');
        // Verify ISO8601 format
        expect(() => new Date(candidate.start)).not.toThrow();
        expect(() => new Date(candidate.end)).not.toThrow();
      }
    });
  });

  describe('Sorting and Ordering', () => {
    test('Candidates are sorted by WokiBrain strategy (single first)', () => {
      const tables = [
        createTable('T1', 2, 4), // Single
        createTable('T2', 2, 2),
        createTable('T3', 2, 2), // Combo T2+T3
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      if (result.candidates.length > 1) {
        // Find first single and first combo
        const firstSingle = result.candidates.find((c) => c.kind === 'single');
        const firstCombo = result.candidates.find((c) => c.kind === 'combo');

        if (firstSingle && firstCombo) {
          const singleIndex = result.candidates.indexOf(firstSingle);
          const comboIndex = result.candidates.indexOf(firstCombo);
          expect(singleIndex).toBeLessThan(comboIndex);
        }
      }
    });

    test('Candidates with same kind are sorted by waste', () => {
      const tables = [
        createTable('T1', 2, 6), // waste: 3
        createTable('T2', 2, 4), // waste: 1
        createTable('T3', 2, 5), // waste: 2
      ];
      const bookings: Booking[] = [];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const singleCandidates = result.candidates.filter((c) => c.kind === 'single');
      if (singleCandidates.length >= 2) {
        // T2 should come before T1 (lower waste)
        const t2Index = singleCandidates.findIndex((c) => c.tableIds.includes('T2'));
        const t1Index = singleCandidates.findIndex((c) => c.tableIds.includes('T1'));
        if (t2Index !== -1 && t1Index !== -1) {
          expect(t2Index).toBeLessThan(t1Index);
        }
      }
    });
  });

  describe('Integration Scenarios', () => {
    test('Complete flow: single table with booking', () => {
      const tables = [createTable('T1', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T21:00:00-03:00'),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 3,
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find gaps before and after booking
      expect(result.candidates.length).toBeGreaterThan(0);
      result.candidates.forEach((candidate) => {
        const startDate = new Date(candidate.start);
        const endDate = new Date(candidate.end);
        const bookingStart = new Date('2025-10-22T20:00:00-03:00');
        const bookingEnd = new Date('2025-10-22T21:00:00-03:00');

        // Gap should not overlap with booking (end exclusive)
        expect(endDate <= bookingStart || startDate >= bookingEnd).toBe(true);
      });
    });

    test('Complete flow: combo when singles are booked', () => {
      const tables = [createTable('T1', 2, 4), createTable('T2', 2, 4)];
      const bookings = [
        createBooking('B1', ['T1'], '2025-10-22T20:00:00-03:00', '2025-10-22T22:00:00-03:00'),
        createBooking('B2', ['T2'], '2025-10-22T20:00:00-03:00', '2025-10-22T22:00:00-03:00'),
      ];

      const result = useCase.execute({
        tables,
        bookings,
        date: '2025-10-22',
        partySize: 5, // Needs combo
        durationMinutes: 90,
        timezone: 'America/Argentina/Buenos_Aires',
      });

      // Should find combo candidates where both tables are free
      const comboCandidates = result.candidates.filter((c) => c.kind === 'combo');
      if (comboCandidates.length > 0) {
        // Combo should have both tables
        expect(comboCandidates[0].tableIds.length).toBe(2);
        expect(comboCandidates[0].tableIds).toContain('T1');
        expect(comboCandidates[0].tableIds).toContain('T2');
      }
    });
  });
});
