import express from 'express';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger/swaggerConfig';
import { createDiscoverRouter } from './routers/discoverRouter';
import { createBookingsRouter } from './routers/bookingsRouter';
import { errorHandler, requestIdMiddleware } from '../middlewares';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../domain/interfaces/repositories';
import { IdempotencyStore } from '../../domain/interfaces/idempotency';
import { LockManager } from '../../domain/interfaces/locks';

/**
 * Application dependencies
 */
export interface AppDependencies {
  restaurantRepo: RestaurantRepository;
  sectorRepo: SectorRepository;
  tableRepo: TableRepository;
  bookingRepo: BookingRepository;
  idempotencyStore: IdempotencyStore;
  lockManager: LockManager;
}

/**
 * Creates and configures the Express application
 *
 * @param dependencies - Application dependencies (repositories, stores, managers)
 * @returns Configured Express app
 */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(requestIdMiddleware);

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Routers
  app.use(
    createDiscoverRouter(
      dependencies.restaurantRepo,
      dependencies.sectorRepo,
      dependencies.tableRepo,
      dependencies.bookingRepo
    )
  );
  app.use(
    createBookingsRouter(
      dependencies.restaurantRepo,
      dependencies.sectorRepo,
      dependencies.tableRepo,
      dependencies.bookingRepo,
      dependencies.idempotencyStore,
      dependencies.lockManager
    )
  );

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

