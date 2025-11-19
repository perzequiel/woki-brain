import { Request, Response, Router } from 'express';
import DiscoverSeatsUseCase from '../../../application/use_cases/discover_seats';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../../domain/interfaces/repositories';
import { DiscoverQuerySchema } from '../schemas';

/**
 * Creates the discover router
 *
 * @param restaurantRepo - Restaurant repository
 * @param sectorRepo - Sector repository
 * @param tableRepo - Table repository
 * @param bookingRepo - Booking repository
 * @returns Express router
 */
export function createDiscoverRouter(
  restaurantRepo: RestaurantRepository,
  sectorRepo: SectorRepository,
  tableRepo: TableRepository,
  bookingRepo: BookingRepository
): Router {
  const router = Router();
  const discoverSeatsUseCase = new DiscoverSeatsUseCase();

  /**
   * @swagger
   * /woki/discover:
   *   get:
   *     summary: Discover available seating options
   *     description: Returns available seating candidates (single tables or combinations) for a party on a specific date
   *     tags: [Discover]
   *     parameters:
   *       - in: query
   *         name: restaurantId
   *         required: true
   *         schema:
   *           type: string
   *         description: Restaurant ID
   *         example: R1
   *       - in: query
   *         name: sectorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Sector ID
   *         example: S1
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Date in YYYY-MM-DD format
   *         example: 2025-10-22
   *       - in: query
   *         name: partySize
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Number of people
   *         example: 5
   *       - in: query
   *         name: duration
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 30
   *           maximum: 180
   *         description: Duration in minutes (multiple of 15)
   *         example: 90
   *       - in: query
   *         name: windowStart
   *         required: false
   *         schema:
   *           type: string
   *           pattern: '^\d{2}:\d{2}$'
   *         description: Optional start time window in HH:mm format
   *         example: 20:00
   *       - in: query
   *         name: windowEnd
   *         required: false
   *         schema:
   *           type: string
   *           pattern: '^\d{2}:\d{2}$'
   *         description: Optional end time window in HH:mm format
   *         example: 23:45
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Maximum number of candidates to return
   *         example: 10
   *     responses:
   *       200:
   *         description: Successfully discovered candidates
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DiscoverResponse'
   *             example:
   *               slotMinutes: 15
   *               durationMinutes: 90
   *               candidates:
   *                 - kind: single
   *                   tableIds: [T4]
   *                   start: '2025-10-22T20:00:00-03:00'
   *                   end: '2025-10-22T21:30:00-03:00'
   *                 - kind: combo
   *                   tableIds: [T2, T3]
   *                   start: '2025-10-22T20:15:00-03:00'
   *                   end: '2025-10-22T21:45:00-03:00'
   *       400:
   *         description: Invalid input parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: invalid_input
   *               detail: duration must be a multiple of 15
   *       404:
   *         description: Restaurant or sector not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: not_found
   *               detail: Restaurant not found
   *       409:
   *         description: No capacity available
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: no_capacity
   *               detail: No single or combo gap fits duration within window
   *       422:
   *         description: Window outside service hours
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: outside_service_window
   *               detail: Window does not intersect service hours
   */
  router.get('/woki/discover', async (req: Request, res: Response) => {
    // Validate query parameters
    const query = DiscoverQuerySchema.parse(req.query);

    // Get restaurant
    const restaurant = await restaurantRepo.findById(query.restaurantId);
    if (!restaurant) {
      res.status(404).json({
        error: 'not_found',
        detail: 'Restaurant not found',
      });
      return;
    }

    // Get sector
    const sector = await sectorRepo.findById(query.sectorId);
    if (!sector || sector.restaurantId !== query.restaurantId) {
      res.status(404).json({
        error: 'not_found',
        detail: 'Sector not found',
      });
      return;
    }

    // Get tables
    const tables = await tableRepo.findBySectorId(query.sectorId);
    if (tables.length === 0) {
      res.status(404).json({
        error: 'not_found',
        detail: 'No tables found for sector',
      });
      return;
    }

    // Get existing bookings
    const bookings = await bookingRepo.findByRestaurantAndDate(query.restaurantId, query.date);

    // Execute discover use case
    const result = discoverSeatsUseCase.execute({
      tables,
      bookings,
      date: query.date,
      partySize: query.partySize,
      durationMinutes: query.duration,
      serviceWindows: restaurant.windows,
      timezone: restaurant.timezone,
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
      limit: query.limit,
    });

    // Return response
    res.status(200).json(result);
  });

  return router;
}
