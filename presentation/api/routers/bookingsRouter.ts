import { Request, Response, Router } from 'express';
import CreateBookingUseCase from '../../../application/use_cases/create_booking';
import ListBookingsUseCase from '../../../application/use_cases/list_bookings';
import { IdempotencyStore } from '../../../domain/interfaces/idempotency';
import { LockManager } from '../../../domain/interfaces/locks';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../../domain/interfaces/repositories';
import { CreateBookingBodySchema, ListBookingsQuerySchema } from '../schemas';

/**
 * Creates the bookings router
 *
 * @param restaurantRepo - Restaurant repository
 * @param sectorRepo - Sector repository
 * @param tableRepo - Table repository
 * @param bookingRepo - Booking repository
 * @param idempotencyStore - Idempotency store
 * @param lockManager - Lock manager
 * @returns Express router
 */
export function createBookingsRouter(
  restaurantRepo: RestaurantRepository,
  sectorRepo: SectorRepository,
  tableRepo: TableRepository,
  bookingRepo: BookingRepository,
  idempotencyStore: IdempotencyStore,
  lockManager: LockManager
): Router {
  const router = Router();
  const createBookingUseCase = new CreateBookingUseCase(
    restaurantRepo,
    sectorRepo,
    tableRepo,
    bookingRepo,
    idempotencyStore,
    lockManager
  );
  const listBookingsUseCase = new ListBookingsUseCase(bookingRepo);

  /**
   * @swagger
   * /woki/bookings:
   *   post:
   *     summary: Create a new booking
   *     description: Creates a booking for a party. Requires Idempotency-Key header for idempotent requests.
   *     tags: [Bookings]
   *     parameters:
   *       - in: header
   *         name: Idempotency-Key
   *         required: true
   *         schema:
   *           type: string
   *         description: Idempotency key for ensuring request idempotency
   *         example: abc-123-xyz
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateBookingRequest'
   *           example:
   *             restaurantId: R1
   *             sectorId: S1
   *             partySize: 5
   *             durationMinutes: 90
   *             date: '2025-10-22'
   *             windowStart: '20:00'
   *             windowEnd: '23:45'
   *     responses:
   *       201:
   *         description: Booking created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Booking'
   *             example:
   *               id: BK_001
   *               restaurantId: R1
   *               sectorId: S1
   *               tableIds: [T4]
   *               partySize: 5
   *               start: '2025-10-22T20:00:00-03:00'
   *               end: '2025-10-22T21:30:00-03:00'
   *               durationMinutes: 90
   *               status: CONFIRMED
   *               createdAt: '2025-10-22T19:50:21-03:00'
   *               updatedAt: '2025-10-22T19:50:21-03:00'
   *       400:
   *         description: Invalid input parameters or missing Idempotency-Key
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: invalid_input
   *               detail: Idempotency-Key header is required
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
   *         description: No capacity available or booking conflict
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
  router.post('/woki/bookings', async (req: Request, res: Response) => {
    // Validate request body
    const body = CreateBookingBodySchema.parse(req.body);

    // Extract Idempotency-Key header
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      res.status(400).json({
        error: 'invalid_input',
        detail: 'Idempotency-Key header is required',
      });
      return;
    }

    // Execute create booking use case
    const result = await createBookingUseCase.execute({
      restaurantId: body.restaurantId,
      sectorId: body.sectorId,
      partySize: body.partySize,
      durationMinutes: body.durationMinutes,
      date: body.date,
      windowStart: body.windowStart,
      windowEnd: body.windowEnd,
      idempotencyKey,
    });

    // Return response
    res.status(201).json(result);
  });

  /**
   * @swagger
   * /woki/bookings/day:
   *   get:
   *     summary: List bookings for a day
   *     description: Returns all bookings for a restaurant on a specific date, optionally filtered by sector
   *     tags: [Bookings]
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
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional sector ID to filter bookings
   *         example: S1
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Date in YYYY-MM-DD format
   *         example: 2025-10-22
   *     responses:
   *       200:
   *         description: Successfully retrieved bookings
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ListBookingsResponse'
   *             example:
   *               date: '2025-10-22'
   *               items:
   *                 - id: BK_001
   *                   tableIds: [T4]
   *                   partySize: 5
   *                   start: '2025-10-22T20:00:00-03:00'
   *                   end: '2025-10-22T21:30:00-03:00'
   *                   status: CONFIRMED
   *       400:
   *         description: Invalid input parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: invalid_input
   *               detail: date must be in YYYY-MM-DD format
   */
  router.get('/woki/bookings/day', async (req: Request, res: Response) => {
    // Validate query parameters
    const query = ListBookingsQuerySchema.parse(req.query);

    // Execute list bookings use case
    const result = await listBookingsUseCase.execute({
      restaurantId: query.restaurantId,
      sectorId: query.sectorId,
      date: query.date,
    });

    // Return response
    res.status(200).json(result);
  });

  return router;
}
