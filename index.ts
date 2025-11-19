import { PinoAdapter } from './infrastructure/logging';
import { InMemoryIdempotencyStore } from './infrastructure/store/idempotency';
import { InMemoryLockManager } from './infrastructure/store/locks';
import {
  InMemoryBookingRepository,
  InMemoryRestaurantRepository,
  InMemorySectorRepository,
  InMemoryTableRepository,
} from './infrastructure/store/repositories';
import { seedData } from './infrastructure/store/seed/seedData';
import { createApp } from './presentation/api/app';

/**
 * Application entry point
 * Initializes in-memory repositories, stores, and managers
 * Creates and starts the Express server
 */
async function main(): Promise<void> {
  // Initialize infrastructure
  const restaurantRepo = new InMemoryRestaurantRepository();
  const sectorRepo = new InMemorySectorRepository();
  const tableRepo = new InMemoryTableRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const lockManager = new InMemoryLockManager();
  const loggingPort = new PinoAdapter();

  // Load seed data
  await seedData(restaurantRepo, sectorRepo, tableRepo, bookingRepo);

  // Create Express app with dependencies
  const app = createApp({
    restaurantRepo,
    sectorRepo,
    tableRepo,
    bookingRepo,
    idempotencyStore,
    lockManager,
    loggingPort,
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 WokiBrain API server running on port ${port}`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /woki/discover`);
    console.log(`   POST /woki/bookings`);
    console.log(`   GET  /woki/bookings/day`);
    console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
  });
}

// Run the application
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
