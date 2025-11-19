import Booking from '../../../domain/entities/booking';
import Restaurant from '../../../domain/entities/restaurant';
import Sector from '../../../domain/entities/sector';
import Table from '../../../domain/entities/table';
import {
  InMemoryBookingRepository,
  InMemoryRestaurantRepository,
  InMemorySectorRepository,
  InMemoryTableRepository,
} from '../repositories';

/**
 * Seeds the in-memory repositories with example data from REQUIREMENTS.md
 */
export async function seedData(
  restaurantRepo: InMemoryRestaurantRepository,
  sectorRepo: InMemorySectorRepository,
  tableRepo: InMemoryTableRepository,
  bookingRepo: InMemoryBookingRepository
): Promise<void> {
  // Restaurant
  const restaurant = Restaurant.create({
    id: 'R1',
    name: 'Bistro Central',
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
    Table.create({
      id: 'T5',
      sectorId: 'S1',
      name: 'Table 5',
      minSize: 2,
      maxSize: 2,
      createdAt: '2025-10-22T00:00:00-03:00',
      updatedAt: '2025-10-22T00:00:00-03:00',
    }),
  ];

  for (const table of tables) {
    await tableRepo.save(table);
  }

  // Booking (example booking)
  const booking = Booking.create({
    id: 'B1',
    restaurantId: 'R1',
    sectorId: 'S1',
    tableIds: ['T2'],
    partySize: 3,
    start: '2025-10-22T20:30:00-03:00',
    end: '2025-10-22T21:15:00-03:00',
    durationMinutes: 45,
    status: 'CONFIRMED',
    createdAt: '2025-10-22T18:00:00-03:00',
    updatedAt: '2025-10-22T18:00:00-03:00',
  });
  await bookingRepo.save(booking);

  console.log('✅ Seed data loaded successfully');
  console.log(`   Restaurant: ${restaurant.name} (${restaurant.id})`);
  console.log(`   Sector: ${sector.name} (${sector.id})`);
  console.log(`   Tables: ${tables.length} tables`);
  console.log(`   Bookings: 1 booking`);
}
