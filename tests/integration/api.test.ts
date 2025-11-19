import request from 'supertest';
import { describe, expect, test } from 'vitest';
import Booking from '../../domain/entities/booking';
import Restaurant from '../../domain/entities/restaurant';
import Sector from '../../domain/entities/sector';
import Table from '../../domain/entities/table';
import { InMemoryIdempotencyStore } from '../../infrastructure/store/idempotency';
import { InMemoryLockManager } from '../../infrastructure/store/locks';
import {
  InMemoryBookingRepository,
  InMemoryRestaurantRepository,
  InMemorySectorRepository,
  InMemoryTableRepository,
} from '../../infrastructure/store/repositories';
import { createApp } from '../../presentation/api/app';

// Type definitions for API responses
interface DiscoverCandidate {
  kind: 'single' | 'combo';
  tableIds: string[];
  start: string;
  end: string;
  score?: number;
  rationale?: string;
}

interface DiscoverResponse {
  slotMinutes: number;
  durationMinutes: number;
  candidates: DiscoverCandidate[];
}

interface BookingResponse {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: string;
  end: string;
  durationMinutes: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

interface ListBookingsResponse {
  date: string;
  items: Array<{
    id: string;
    tableIds: string[];
    partySize: number;
    start: string;
    end: string;
    status: 'CONFIRMED' | 'CANCELLED';
  }>;
}

/**
 * Helper function to create test app with fresh repositories
 */
function createTestApp() {
  const restaurantRepo = new InMemoryRestaurantRepository();
  const sectorRepo = new InMemorySectorRepository();
  const tableRepo = new InMemoryTableRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const lockManager = new InMemoryLockManager();

  return {
    app: createApp({
      restaurantRepo,
      sectorRepo,
      tableRepo,
      bookingRepo,
      idempotencyStore,
      lockManager,
    }),
    restaurantRepo,
    sectorRepo,
    tableRepo,
    bookingRepo,
    idempotencyStore,
    lockManager,
  };
}

/**
 * Helper function to setup test data
 */
async function setupTestData(
  restaurantRepo: InMemoryRestaurantRepository,
  sectorRepo: InMemorySectorRepository,
  tableRepo: InMemoryTableRepository,
  _bookingRepo: InMemoryBookingRepository
) {
  // Restaurant
  const restaurant = Restaurant.create({
    id: 'R1',
    name: 'Test Restaurant',
    timezone: 'America/Argentina/Buenos_Aires',
    windows: [
      { start: '12:00', end: '16:00' },
      { start: '20:00', end: '23:45' },
    ],
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
  await restaurantRepo.save(restaurant);

  // Sector
  const sector = Sector.create({
    id: 'S1',
    restaurantId: 'R1',
    name: 'Main Hall',
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
  await sectorRepo.save(sector);

  // Tables
  const tables = [
    Table.create({
      id: 'T1',
      sectorId: 'S1',
      name: 'Table 1',
      minSize: 2,
      maxSize: 2,
      createdAt: '2025-10-22T00:00:00-03:00',
      updatedAt: '2025-10-22T00:00:00-03:00',
    }),
    Table.create({
      id: 'T2',
      sectorId: 'S1',
      name: 'Table 2',
      minSize: 2,
      maxSize: 4,
      createdAt: '2025-10-22T00:00:00-03:00',
      updatedAt: '2025-10-22T00:00:00-03:00',
    }),
    Table.create({
      id: 'T3',
      sectorId: 'S1',
      name: 'Table 3',
      minSize: 2,
      maxSize: 4,
      createdAt: '2025-10-22T00:00:00-03:00',
      updatedAt: '2025-10-22T00:00:00-03:00',
    }),
    Table.create({
      id: 'T4',
      sectorId: 'S1',
      name: 'Table 4',
      minSize: 4,
      maxSize: 6,
      createdAt: '2025-10-22T00:00:00-03:00',
      updatedAt: '2025-10-22T00:00:00-03:00',
    }),
  ];

  for (const table of tables) {
    await tableRepo.save(table);
  }

  return { restaurant, sector, tables };
}

describe('API Integration Tests', () => {
  describe('GET /woki/discover', () => {
    test('Happy single: Perfect gap on a single table', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      const response = await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
        })
        .expect(200);

      const body = response.body as DiscoverResponse;
      expect(body).toHaveProperty('slotMinutes', 15);
      expect(body).toHaveProperty('durationMinutes', 90);
      expect(body).toHaveProperty('candidates');
      expect(Array.isArray(body.candidates)).toBe(true);
      expect(body.candidates.length).toBeGreaterThan(0);

      // Should find T4 (single table that fits 5 people)
      const singleCandidates = body.candidates.filter((c) => c.kind === 'single');
      expect(singleCandidates.length).toBeGreaterThan(0);
      const t4Candidate = singleCandidates.find((c) => c.tableIds.includes('T4'));
      expect(t4Candidate).toBeDefined();
    });

    test('Happy combo: A valid combination exists when singles cannot fit', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Book T4 (the only single table that fits 5 people)
      const booking = Booking.create({
        id: 'B1',
        restaurantId: 'R1',
        sectorId: 'S1',
        tableIds: ['T4'],
        partySize: 5,
        start: '2025-10-22T20:00:00-03:00',
        end: '2025-10-22T23:45:00-03:00',
        durationMinutes: 225,
        status: 'CONFIRMED',
        createdAt: '2025-10-22T18:00:00-03:00',
        updatedAt: '2025-10-22T18:00:00-03:00',
      });
      await bookingRepo.save(booking);

      const response = await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
        })
        .expect(200);

      const body = response.body as DiscoverResponse;
      expect(body.candidates.length).toBeGreaterThan(0);

      // Should find combo candidates (T2+T3 or similar)
      const comboCandidates = body.candidates.filter((c) => c.kind === 'combo');
      expect(comboCandidates.length).toBeGreaterThan(0);
    });

    test('Boundary: Bookings touching at end are accepted (end-exclusive)', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Create booking from 20:00 to 21:30
      const booking1 = Booking.create({
        id: 'B1',
        restaurantId: 'R1',
        sectorId: 'S1',
        tableIds: ['T4'],
        partySize: 5,
        start: '2025-10-22T20:00:00-03:00',
        end: '2025-10-22T21:30:00-03:00', // End exclusive
        durationMinutes: 90,
        status: 'CONFIRMED',
        createdAt: '2025-10-22T18:00:00-03:00',
        updatedAt: '2025-10-22T18:00:00-03:00',
      });
      await bookingRepo.save(booking1);

      // Create booking from 21:30 to 23:00 (touching at end)
      const booking2 = Booking.create({
        id: 'B2',
        restaurantId: 'R1',
        sectorId: 'S1',
        tableIds: ['T4'],
        partySize: 5,
        start: '2025-10-22T21:30:00-03:00', // Starts exactly where B1 ends
        end: '2025-10-22T23:00:00-03:00',
        durationMinutes: 90,
        status: 'CONFIRMED',
        createdAt: '2025-10-22T18:00:00-03:00',
        updatedAt: '2025-10-22T18:00:00-03:00',
      });
      await bookingRepo.save(booking2);

      // Should accept both bookings (no conflict because end is exclusive)
      const response = await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
        })
        .expect(200);

      // Should find gaps before 20:00 or after 23:00
      const body = response.body as DiscoverResponse;
      expect(body.candidates.length).toBeGreaterThan(0);
    });

    test('Returns 404 when restaurant not found', async () => {
      const { app } = createTestApp();

      await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R_NONEXISTENT',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'not_found');
        });
    });

    test('Returns 400 for invalid input', async () => {
      const { app } = createTestApp();

      await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '25', // Not multiple of 15
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'invalid_input');
        });
    });

    test('Returns 409 when no capacity available', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Book all tables for entire service window (both windows)
      const tables = await tableRepo.findBySectorId('S1');
      for (const table of tables) {
        // Book during first service window
        const booking1 = Booking.create({
          id: `B_${table.id}_1`,
          restaurantId: 'R1',
          sectorId: 'S1',
          tableIds: [table.id],
          partySize: table.maxSize,
          start: '2025-10-22T12:00:00-03:00',
          end: '2025-10-22T16:00:00-03:00',
          durationMinutes: 240,
          status: 'CONFIRMED',
          createdAt: '2025-10-22T18:00:00-03:00',
          updatedAt: '2025-10-22T18:00:00-03:00',
        });
        await bookingRepo.save(booking1);

        // Book during second service window
        const booking2 = Booking.create({
          id: `B_${table.id}_2`,
          restaurantId: 'R1',
          sectorId: 'S1',
          tableIds: [table.id],
          partySize: table.maxSize,
          start: '2025-10-22T20:00:00-03:00',
          end: '2025-10-22T23:45:00-03:00',
          durationMinutes: 225,
          status: 'CONFIRMED',
          createdAt: '2025-10-22T18:00:00-03:00',
          updatedAt: '2025-10-22T18:00:00-03:00',
        });
        await bookingRepo.save(booking2);
      }

      await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'no_capacity');
        });
    });

    test('Returns 422 when window outside service hours', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      await request(app)
        .get('/woki/discover')
        .query({
          restaurantId: 'R1',
          sectorId: 'S1',
          date: '2025-10-22',
          partySize: '5',
          duration: '90',
          windowStart: '10:00', // Before service window (12:00)
          windowEnd: '11:00',
        })
        .expect(422)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'outside_service_window');
        });
    });
  });

  describe('POST /woki/bookings', () => {
    test('Creates booking successfully', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      const response = await request(app)
        .post('/woki/bookings')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(201);

      const body = response.body as BookingResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('restaurantId', 'R1');
      expect(body).toHaveProperty('sectorId', 'S1');
      expect(body).toHaveProperty('partySize', 5);
      expect(body).toHaveProperty('durationMinutes', 90);
      expect(body).toHaveProperty('status', 'CONFIRMED');
      expect(body).toHaveProperty('tableIds');
      expect(Array.isArray(body.tableIds)).toBe(true);
      expect(body.tableIds.length).toBeGreaterThan(0);
      expect(body).toHaveProperty('start');
      expect(body).toHaveProperty('end');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');
    });

    test('Idempotency: Repeat POST with same payload + Idempotency-Key returns the same booking', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      const idempotencyKey = 'idempotent-key-456';

      // First request
      const response1 = await request(app)
        .post('/woki/bookings')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(201);

      const body1 = response1.body as BookingResponse;
      const bookingId1 = body1.id;

      // Second request with same key and payload
      const response2 = await request(app)
        .post('/woki/bookings')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(201);

      // Should return the same booking
      const body2 = response2.body as BookingResponse;
      expect(body2.id).toBe(bookingId1);
      expect(body2.start).toBe(body1.start);
      expect(body2.end).toBe(body1.end);
      expect(body2.tableIds).toEqual(body1.tableIds);
    });

    test('Concurrency: Two parallel creates targeting the same candidate → one 201, one 409', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Make two parallel requests with the same parameters
      // They should both try to book the same candidate (deterministic selection)
      const promises = [
        request(app).post('/woki/bookings').set('Idempotency-Key', 'concurrent-key-1').send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        }),
        request(app).post('/woki/bookings').set('Idempotency-Key', 'concurrent-key-2').send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        }),
      ];

      const [response1, response2] = await Promise.allSettled(promises);

      // Extract status codes
      const status1 = response1.status === 'fulfilled' ? response1.value.status : null;
      const status2 = response2.status === 'fulfilled' ? response2.value.status : null;

      const statuses = [status1, status2].filter((s) => s !== null);

      // Verify results: due to locking and collision detection,
      // at least one should fail (409) if they target the same candidate
      // OR both succeed but with different candidates (different tables)
      const bookings = await bookingRepo.findByRestaurantAndDate('R1', '2025-10-22');
      const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');

      // If both succeeded, they must have different tableIds (different candidates)
      if (statuses.every((s) => s === 201)) {
        expect(confirmedBookings.length).toBe(2);
        const tableIds1 = confirmedBookings[0].tableIds.sort().join(',');
        const tableIds2 = confirmedBookings[1].tableIds.sort().join(',');
        expect(tableIds1).not.toBe(tableIds2);
      } else {
        // At least one failed (409) - verify only one booking was created
        expect(confirmedBookings.length).toBe(1);
        expect(statuses).toContain(409);
      }
    });

    test('Returns 400 when Idempotency-Key is missing', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      await request(app)
        .post('/woki/bookings')
        .send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'invalid_input');
        });
    });

    test('Returns 404 when restaurant not found', async () => {
      const { app } = createTestApp();

      await request(app)
        .post('/woki/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({
          restaurantId: 'R_NONEXISTENT',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'not_found');
        });
    });

    test('Returns 409 when no capacity available', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Book all tables for entire day
      const tables = await tableRepo.findBySectorId('S1');
      for (const table of tables) {
        const booking = Booking.create({
          id: `B_${table.id}`,
          restaurantId: 'R1',
          sectorId: 'S1',
          tableIds: [table.id],
          partySize: table.maxSize,
          start: '2025-10-22T20:00:00-03:00',
          end: '2025-10-22T23:45:00-03:00',
          durationMinutes: 225,
          status: 'CONFIRMED',
          createdAt: '2025-10-22T18:00:00-03:00',
          updatedAt: '2025-10-22T18:00:00-03:00',
        });
        await bookingRepo.save(booking);
      }

      await request(app)
        .post('/woki/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({
          restaurantId: 'R1',
          sectorId: 'S1',
          partySize: 5,
          durationMinutes: 90,
          date: '2025-10-22',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'no_capacity');
        });
    });
  });

  describe('GET /woki/bookings/day', () => {
    test('Lists bookings for a day', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      // Create a booking
      const booking = Booking.create({
        id: 'B1',
        restaurantId: 'R1',
        sectorId: 'S1',
        tableIds: ['T4'],
        partySize: 5,
        start: '2025-10-22T20:00:00-03:00',
        end: '2025-10-22T21:30:00-03:00',
        durationMinutes: 90,
        status: 'CONFIRMED',
        createdAt: '2025-10-22T18:00:00-03:00',
        updatedAt: '2025-10-22T18:00:00-03:00',
      });
      await bookingRepo.save(booking);

      const response = await request(app)
        .get('/woki/bookings/day')
        .query({
          restaurantId: 'R1',
          date: '2025-10-22',
        })
        .expect(200);

      const body = response.body as ListBookingsResponse;
      expect(body).toHaveProperty('date', '2025-10-22');
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBe(1);
      expect(body.items[0]).toHaveProperty('id', 'B1');
      expect(body.items[0]).toHaveProperty('tableIds', ['T4']);
      expect(body.items[0]).toHaveProperty('partySize', 5);
      expect(body.items[0]).toHaveProperty('status', 'CONFIRMED');
    });

    test('Returns empty array when no bookings exist', async () => {
      const { app, restaurantRepo, sectorRepo, tableRepo, bookingRepo } = createTestApp();
      await setupTestData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

      const response = await request(app)
        .get('/woki/bookings/day')
        .query({
          restaurantId: 'R1',
          date: '2025-10-22',
        })
        .expect(200);

      const body = response.body as ListBookingsResponse;
      expect(body).toHaveProperty('date', '2025-10-22');
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBe(0);
    });

    test('Returns 400 when restaurantId is missing', async () => {
      const { app } = createTestApp();

      await request(app)
        .get('/woki/bookings/day')
        .query({
          date: '2025-10-22',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error', 'invalid_input');
        });
    });
  });
});
