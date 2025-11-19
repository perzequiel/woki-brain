import { describe, expect, test } from 'vitest';
import ListBookingsUseCase from '../../application/use_cases/list_bookings';
import Booking from '../../domain/entities/booking';
import { BookingRepository } from '../../domain/interfaces/repositories';

function createMockBookingRepository(): BookingRepository {
  const bookings = new Map<string, Booking[]>();

  return {
    findById: async (id: string) => {
      for (const bookingList of bookings.values()) {
        const booking = bookingList.find((b) => b.id === id);
        if (booking) return booking;
      }
      return null;
    },
    findByRestaurantAndDate: async (restaurantId: string, date: string) => {
      return bookings.get(`${restaurantId}|${date}`) || [];
    },
    findByTableAndDate: async (tableIds: string[], date: string) => {
      const allBookings: Booking[] = [];
      for (const bookingList of bookings.values()) {
        for (const booking of bookingList) {
          if (booking.tableIds.some((id) => tableIds.includes(id))) {
            allBookings.push(booking);
          }
        }
      }
      return allBookings;
    },
    save: async (booking: Booking) => {
      const key = `${booking.restaurantId}|${booking.start.split('T')[0]}`;
      const existing = bookings.get(key) || [];
      existing.push(booking);
      bookings.set(key, existing);
      return booking;
    },
  };
}

function createBooking(
  id: string,
  restaurantId: string,
  sectorId: string,
  tableIds: string[],
  start: string,
  end: string
): Booking {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));

  return Booking.create({
    id,
    restaurantId,
    sectorId,
    tableIds,
    partySize: 2,
    start,
    end,
    durationMinutes,
    status: 'CONFIRMED',
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

describe('List Bookings Use Case', () => {
  describe('Basic Listing', () => {
    test('Returns bookings for restaurant and date', async () => {
      const bookingRepo = createMockBookingRepository();

      // Create some bookings
      const booking1 = createBooking(
        'BK1',
        'R1',
        'S1',
        ['T1'],
        '2025-10-22T20:00:00-03:00',
        '2025-10-22T21:30:00-03:00'
      );
      const booking2 = createBooking(
        'BK2',
        'R1',
        'S1',
        ['T2'],
        '2025-10-22T21:00:00-03:00',
        '2025-10-22T22:30:00-03:00'
      );

      await bookingRepo.save(booking1);
      await bookingRepo.save(booking2);

      const useCase = new ListBookingsUseCase(bookingRepo);

      const result = await useCase.execute({
        restaurantId: 'R1',
        date: '2025-10-22',
      });

      expect(result.date).toBe('2025-10-22');
      expect(result.items.length).toBe(2);
      expect(result.items.map((i) => i.id)).toContain('BK1');
      expect(result.items.map((i) => i.id)).toContain('BK2');
    });

    test('Filters by sector when provided', async () => {
      const bookingRepo = createMockBookingRepository();

      const booking1 = createBooking(
        'BK1',
        'R1',
        'S1',
        ['T1'],
        '2025-10-22T20:00:00-03:00',
        '2025-10-22T21:30:00-03:00'
      );
      const booking2 = createBooking(
        'BK2',
        'R1',
        'S2',
        ['T2'],
        '2025-10-22T21:00:00-03:00',
        '2025-10-22T22:30:00-03:00'
      );

      await bookingRepo.save(booking1);
      await bookingRepo.save(booking2);

      const useCase = new ListBookingsUseCase(bookingRepo);

      const result = await useCase.execute({
        restaurantId: 'R1',
        sectorId: 'S1',
        date: '2025-10-22',
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('BK1');
    });

    test('Returns empty array when no bookings exist', async () => {
      const bookingRepo = createMockBookingRepository();
      const useCase = new ListBookingsUseCase(bookingRepo);

      const result = await useCase.execute({
        restaurantId: 'R1',
        date: '2025-10-22',
      });

      expect(result.date).toBe('2025-10-22');
      expect(result.items.length).toBe(0);
    });
  });

  describe('Response Format', () => {
    test('Returns correct response structure', async () => {
      const bookingRepo = createMockBookingRepository();

      const booking = createBooking(
        'BK1',
        'R1',
        'S1',
        ['T1'],
        '2025-10-22T20:00:00-03:00',
        '2025-10-22T21:30:00-03:00'
      );

      await bookingRepo.save(booking);

      const useCase = new ListBookingsUseCase(bookingRepo);

      const result = await useCase.execute({
        restaurantId: 'R1',
        date: '2025-10-22',
      });

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);

      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('tableIds');
        expect(item).toHaveProperty('partySize');
        expect(item).toHaveProperty('start');
        expect(item).toHaveProperty('end');
        expect(item).toHaveProperty('status');
      }
    });
  });
});
