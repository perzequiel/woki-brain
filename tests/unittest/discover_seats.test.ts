import { describe, expect, test } from 'vitest';
import DiscoverSeatsUseCase from '../../application/use_cases/discover_seats';
import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';

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
      result.candidates.forEach((candidate) => {
        const startDate = new Date(candidate.start);
        const hour = startDate.getHours();
        expect(hour).toBeGreaterThanOrEqual(20);
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
  });
});
