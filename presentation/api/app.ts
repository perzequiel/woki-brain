import type { Express } from 'express';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { IdempotencyStore } from '../../domain/interfaces/idempotency';
import { LockManager } from '../../domain/interfaces/locks';
import { LoggingPort } from '../../domain/interfaces/logging';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../domain/interfaces/repositories';
import { errorHandler, requestIdMiddleware } from '../middlewares';
import { createBookingsRouter } from './routers/bookingsRouter';
import { createDiscoverRouter } from './routers/discoverRouter';
import { swaggerSpec } from './swagger/swaggerConfig';

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
  loggingPort?: LoggingPort; // Optional: if not provided, logging will be no-op
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
      dependencies.bookingRepo,
      dependencies.loggingPort
    )
  );
  app.use(
    createBookingsRouter(
      dependencies.restaurantRepo,
      dependencies.sectorRepo,
      dependencies.tableRepo,
      dependencies.bookingRepo,
      dependencies.idempotencyStore,
      dependencies.lockManager,
      dependencies.loggingPort
    )
  );

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
