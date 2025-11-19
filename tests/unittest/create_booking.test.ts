import { describe, expect, test, vi } from 'vitest';
import CreateBookingUseCase, { CreateBookingError } from '../../application/use_cases/create_booking';
import Booking from '../../domain/entities/booking';
import Restaurant from '../../domain/entities/restaurant';
import Sector from '../../domain/entities/sector';
import Table from '../../domain/entities/table';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../domain/interfaces/repositories';
import { IdempotencyStore } from '../../domain/interfaces/idempotency';
import { LockManager } from '../../domain/interfaces/locks';

// Mock implementations for testing
function createMockRepositories() {
  const restaurants = new Map<string, Restaurant>();
  const sectors = new Map<string, Sector>();
  const tables = new Map<string, Table[]>();
  const bookings = new Map<string, Booking[]>();

  const restaurantRepo: RestaurantRepository = {
    findById: async (id: string) => restaurants.get(id) || null,
  };

  const sectorRepo: SectorRepository = {
    findById: async (id: string) => sectors.get(id) || null,
    findByRestaurantId: async (restaurantId: string) => {
      return Array.from(sectors.values()).filter((s) => s.restaurantId === restaurantId);
    },
  };

  const tableRepo: TableRepository = {
    findById: async (id: string) => {
      for (const tableList of tables.values()) {
        const table = tableList.find((t) => t.id === id);
        if (table) return table;
      }
      return null;
    },
    findBySectorId: async (sectorId: string) => tables.get(sectorId) || [],
  };

  const bookingRepo: BookingRepository = {
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

  return {
    restaurantRepo,
    sectorRepo,
    tableRepo,
    bookingRepo,
    restaurants,
    sectors,
    tables,
    bookings,
  };
}

function createMockIdempotencyStore(): IdempotencyStore {
  const store = new Map<string, Booking>();

  return {
    get: async (key: string) => store.get(key) || null,
    set: async (key: string, booking: Booking, ttl?: number) => {
      store.set(key, booking);
    },
  };
}

function createMockLockManager(): LockManager {
  const locks = new Set<string>();

  return {
    acquire: async (key: string, ttl?: number) => {
      if (locks.has(key)) {
        return false;
      }
      locks.add(key);
      return true;
    },
    release: async (key: string) => {
      locks.delete(key);
    },
  };
}

function createRestaurant(id: string, timezone: string = 'America/Argentina/Buenos_Aires'): Restaurant {
  return Restaurant.create({
    id,
    name: `Restaurant ${id}`,
    timezone,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

function createSector(id: string, restaurantId: string): Sector {
  return Sector.create({
    id,
    restaurantId,
    name: `Sector ${id}`,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

function createTable(id: string, sectorId: string, minSize: number, maxSize: number): Table {
  return Table.create({
    id,
    sectorId,
    name: `Table ${id}`,
    minSize,
    maxSize,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

describe('Create Booking Use Case', () => {
  describe('Basic Creation', () => {
    test('Creates booking successfully', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      // Setup data
      const restaurant = createRestaurant('R1');
      mocks.restaurants.set('R1', restaurant);

      const sector = createSector('S1', 'R1');
      mocks.sectors.set('S1', sector);

      const tables = [
        createTable('T1', 'S1', 2, 4),
        createTable('T2', 'S1', 2, 4),
      ];
      mocks.tables.set('S1', tables);

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      const result = await useCase.execute({
        restaurantId: 'R1',
        sectorId: 'S1',
        partySize: 3,
        durationMinutes: 90,
        date: '2025-10-22',
        idempotencyKey: 'key-123',
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe('R1');
      expect(result.sectorId).toBe('S1');
      expect(result.partySize).toBe(3);
      expect(result.status).toBe('CONFIRMED');
      expect(result.tableIds.length).toBeGreaterThan(0);
    });

    test('Returns existing booking for same idempotency key', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      // Setup data
      const restaurant = createRestaurant('R1');
      mocks.restaurants.set('R1', restaurant);

      const sector = createSector('S1', 'R1');
      mocks.sectors.set('S1', sector);

      const tables = [createTable('T1', 'S1', 2, 4)];
      mocks.tables.set('S1', tables);

      // Create existing booking
      const existingBooking = Booking.create({
        id: 'BK_EXISTING',
        restaurantId: 'R1',
        sectorId: 'S1',
        tableIds: ['T1'],
        partySize: 3,
        start: '2025-10-22T20:00:00-03:00',
        end: '2025-10-22T21:30:00-03:00',
        durationMinutes: 90,
        status: 'CONFIRMED',
        createdAt: '2025-10-22T19:00:00-03:00',
        updatedAt: '2025-10-22T19:00:00-03:00',
      });

      await idempotencyStore.set('key-123', existingBooking);

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      const result = await useCase.execute({
        restaurantId: 'R1',
        sectorId: 'S1',
        partySize: 3,
        durationMinutes: 90,
        date: '2025-10-22',
        idempotencyKey: 'key-123',
      });

      // Should return existing booking
      expect(result.id).toBe('BK_EXISTING');
    });
  });

  describe('Error Cases', () => {
    test('Throws NOT_FOUND when restaurant does not exist', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      await expect(
        useCase.execute({
          restaurantId: 'R_NONEXISTENT',
          sectorId: 'S1',
          partySize: 3,
          durationMinutes: 90,
          date: '2025-10-22',
          idempotencyKey: 'key-123',
        })
      ).rejects.toThrow(CreateBookingError.NOT_FOUND);
    });

    test('Throws NOT_FOUND when sector does not exist', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      const restaurant = createRestaurant('R1');
      mocks.restaurants.set('R1', restaurant);

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      await expect(
        useCase.execute({
          restaurantId: 'R1',
          sectorId: 'S_NONEXISTENT',
          partySize: 3,
          durationMinutes: 90,
          date: '2025-10-22',
          idempotencyKey: 'key-123',
        })
      ).rejects.toThrow(CreateBookingError.NOT_FOUND);
    });

    test('Throws INVALID_INPUT for invalid duration', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      await expect(
        useCase.execute({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 3,
          durationMinutes: 25, // Not multiple of 15
          date: '2025-10-22',
          idempotencyKey: 'key-123',
        })
      ).rejects.toThrow(CreateBookingError.INVALID_INPUT);
    });

    test('Throws NO_CAPACITY when no candidates available', async () => {
      const mocks = createMockRepositories();
      const idempotencyStore = createMockIdempotencyStore();
      const lockManager = createMockLockManager();

      const restaurant = createRestaurant('R1');
      mocks.restaurants.set('R1', restaurant);

      const sector = createSector('S1', 'R1');
      mocks.sectors.set('S1', sector);

      // Table too small
      const tables = [createTable('T1', 'S1', 2, 2)];
      mocks.tables.set('S1', tables);

      const useCase = new CreateBookingUseCase(
        mocks.restaurantRepo,
        mocks.sectorRepo,
        mocks.tableRepo,
        mocks.bookingRepo,
        idempotencyStore,
        lockManager
      );

      await expect(
        useCase.execute({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5, // Too large for T1
          durationMinutes: 90,
          date: '2025-10-22',
          idempotencyKey: 'key-123',
        })
      ).rejects.toThrow(CreateBookingError.NO_CAPACITY);
    });
  });
});

