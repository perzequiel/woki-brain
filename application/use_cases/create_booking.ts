import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';
import { IdempotencyStore } from '../../domain/interfaces/idempotency';
import { LockManager } from '../../domain/interfaces/locks';
import {
  BookingRepository,
  RestaurantRepository,
  SectorRepository,
  TableRepository,
} from '../../domain/interfaces/repositories';
import { isValidDuration } from '../../domain/services/time';
import WokiBrainService, { Candidate } from '../../domain/services/wokibrain';
import DiscoverSeatsUseCase, { DiscoverSeatsInput } from './discover_seats';

/**
 * Input for Create Booking use case
 */
export interface CreateBookingInput {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  windowStart?: string; // Optional: HH:mm
  windowEnd?: string; // Optional: HH:mm
  idempotencyKey: string; // Required: Idempotency-Key header
}

/**
 * Response from Create Booking use case
 */
export interface CreateBookingResponse {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  start: string; // ISO8601
  end: string; // ISO8601
  durationMinutes: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

/**
 * Error types for Create Booking
 */
export enum CreateBookingError {
  INVALID_INPUT = 'invalid_input',
  NOT_FOUND = 'not_found',
  NO_CAPACITY = 'no_capacity',
  OUTSIDE_SERVICE_WINDOW = 'outside_service_window',
  CONFLICT = 'conflict',
}

/**
 * Create Booking Use Case
 *
 * Orchestrates the creation of a booking with:
 * - Idempotency support
 * - Concurrency control (locking)
 * - Collision detection
 * - Automatic candidate selection using WokiBrain
 */
class CreateBookingUseCase {
  private readonly restaurantRepo: RestaurantRepository;
  private readonly sectorRepo: SectorRepository;
  private readonly tableRepo: TableRepository;
  private readonly bookingRepo: BookingRepository;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly lockManager: LockManager;
  private readonly discoverSeatsUseCase: DiscoverSeatsUseCase;
  private readonly wokiBrainService: WokiBrainService;

  constructor(
    restaurantRepo: RestaurantRepository,
    sectorRepo: SectorRepository,
    tableRepo: TableRepository,
    bookingRepo: BookingRepository,
    idempotencyStore: IdempotencyStore,
    lockManager: LockManager
  ) {
    this.restaurantRepo = restaurantRepo;
    this.sectorRepo = sectorRepo;
    this.tableRepo = tableRepo;
    this.bookingRepo = bookingRepo;
    this.idempotencyStore = idempotencyStore;
    this.lockManager = lockManager;
    this.discoverSeatsUseCase = new DiscoverSeatsUseCase();
    this.wokiBrainService = new WokiBrainService();
  }

  /**
   * Creates a booking for a party.
   *
   * @param input - Create booking input parameters
   * @returns CreateBookingResponse with created booking
   * @throws Error with CreateBookingError type
   */
  public async execute(input: CreateBookingInput): Promise<CreateBookingResponse> {
    const {
      restaurantId,
      sectorId,
      partySize,
      durationMinutes,
      date,
      windowStart,
      windowEnd,
      idempotencyKey,
    } = input;

    // Step 1: Validate inputs
    this.validateInputs(partySize, durationMinutes);

    // Step 2: Check idempotency
    const existingBooking = await this.idempotencyStore.get(idempotencyKey);
    if (existingBooking) {
      return this.bookingToResponse(existingBooking);
    }

    // Step 3: Get restaurant, sector, and tables
    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      throw new Error(CreateBookingError.NOT_FOUND);
    }

    const sector = await this.sectorRepo.findById(sectorId);
    if (!sector || sector.restaurantId !== restaurantId) {
      throw new Error(CreateBookingError.NOT_FOUND);
    }

    const tables = await this.tableRepo.findBySectorId(sectorId);
    if (tables.length === 0) {
      throw new Error(CreateBookingError.NOT_FOUND);
    }

    // Step 4: Get existing bookings for the day
    const existingBookings = await this.bookingRepo.findByRestaurantAndDate(restaurantId, date);

    // Step 5: Discover available seats
    const discoverInput: DiscoverSeatsInput = {
      tables,
      bookings: existingBookings,
      date,
      partySize,
      durationMinutes,
      serviceWindows: restaurant.windows,
      timezone: restaurant.timezone,
      windowStart,
      windowEnd,
      limit: 10,
    };

    const discoverResult = this.discoverSeatsUseCase.execute(discoverInput);

    if (discoverResult.candidates.length === 0) {
      throw new Error(CreateBookingError.NO_CAPACITY);
    }

    // Step 6: Select best candidate using WokiBrain
    // Convert API candidates back to domain candidates for selection
    const candidates = this.convertToDomainCandidates(discoverResult.candidates, tables, partySize);
    const bestResult = this.wokiBrainService.selectBest({ candidates, partySize });

    if (!bestResult.hasCapacity || !bestResult.candidate) {
      throw new Error(CreateBookingError.NO_CAPACITY);
    }

    const selectedCandidate = bestResult.candidate;

    // Step 7: Generate lock key
    const lockKey = this.generateLockKey(
      restaurantId,
      sectorId,
      selectedCandidate.tableIds,
      selectedCandidate.gap.start
    );

    // Step 8: Acquire lock
    const lockAcquired = await this.lockManager.acquire(lockKey, 5000);
    if (!lockAcquired) {
      throw new Error(CreateBookingError.CONFLICT);
    }

    try {
      // Step 9: Re-verify bookings after lock (collision check)
      const currentBookings = await this.bookingRepo.findByRestaurantAndDate(restaurantId, date);
      const collision = this.checkCollision(
        selectedCandidate,
        currentBookings,
        selectedCandidate.tableIds
      );

      if (collision) {
        throw new Error(CreateBookingError.CONFLICT);
      }

      // Step 10: Create booking entity
      const now = new Date().toISOString();
      const booking = Booking.create({
        id: this.generateBookingId(),
        restaurantId,
        sectorId,
        tableIds: selectedCandidate.tableIds,
        partySize,
        start: selectedCandidate.gap.start.toISOString(),
        end: selectedCandidate.gap.end.toISOString(),
        durationMinutes,
        status: 'CONFIRMED',
        createdAt: now,
        updatedAt: now,
      });

      // Step 11: Save booking
      const savedBooking = await this.bookingRepo.save(booking);

      // Step 12: Store idempotency mapping
      await this.idempotencyStore.set(idempotencyKey, savedBooking, 60000);

      return this.bookingToResponse(savedBooking);
    } finally {
      // Step 13: Release lock
      await this.lockManager.release(lockKey);
    }
  }

  /**
   * Validates input parameters.
   */
  private validateInputs(partySize: number, durationMinutes: number): void {
    if (partySize <= 0 || !Number.isInteger(partySize)) {
      throw new Error(CreateBookingError.INVALID_INPUT);
    }

    if (!isValidDuration(durationMinutes)) {
      throw new Error(CreateBookingError.INVALID_INPUT);
    }
  }

  /**
   * Converts API candidates to domain candidates.
   */
  private convertToDomainCandidates(
    apiCandidates: Array<{
      kind: 'single' | 'combo';
      tableIds: string[];
      start: string;
      end: string;
    }>,
    tables: Table[],
    partySize: number
  ): Candidate[] {
    return apiCandidates.map((apiCandidate) => {
      const candidateTables = apiCandidate.tableIds.map((id) => {
        const table = tables.find((t) => t.id === id);
        if (!table) {
          throw new Error('Table not found');
        }
        return table;
      });

      const gap = {
        start: new Date(apiCandidate.start),
        end: new Date(apiCandidate.end),
        durationMinutes: Math.floor(
          (new Date(apiCandidate.end).getTime() - new Date(apiCandidate.start).getTime()) /
            (1000 * 60)
        ),
      };

      // Calculate capacity and waste
      const capacity = {
        minSize: candidateTables.reduce((sum, t) => sum + t.minSize, 0),
        maxSize: candidateTables.reduce((sum, t) => sum + t.maxSize, 0),
      };

      const waste = capacity.maxSize - partySize;

      return {
        kind: apiCandidate.kind,
        tableIds: apiCandidate.tableIds,
        gap,
        capacity,
        waste,
      };
    });
  }

  /**
   * Generates lock key from booking parameters.
   * Format: {restaurantId}|{sectorId}|{tableIds.join('+')}|{normalizedStart}
   */
  private generateLockKey(
    restaurantId: string,
    sectorId: string,
    tableIds: string[],
    start: Date
  ): string {
    const normalizedStart = start.toISOString();
    const tableIdsStr = tableIds.sort().join('+');
    return `${restaurantId}|${sectorId}|${tableIdsStr}|${normalizedStart}`;
  }

  /**
   * Checks if selected candidate collides with existing bookings.
   */
  private checkCollision(
    candidate: Candidate,
    existingBookings: Booking[],
    tableIds: string[]
  ): boolean {
    const candidateStart = candidate.gap.start;
    const candidateEnd = candidate.gap.end;

    // Check for overlapping bookings on the same tables
    for (const booking of existingBookings) {
      if (booking.status !== 'CONFIRMED') {
        continue;
      }

      // Check if booking uses any of the candidate tables
      const sharesTable = booking.tableIds.some((id) => tableIds.includes(id));
      if (!sharesTable) {
        continue;
      }

      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);

      // Check for overlap: [start, end) intervals
      // Overlap if: candidateStart < bookingEnd && candidateEnd > bookingStart
      if (candidateStart < bookingEnd && candidateEnd > bookingStart) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  }

  /**
   * Generates a unique booking ID.
   */
  private generateBookingId(): string {
    return `BK_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Converts Booking entity to API response format.
   */
  private bookingToResponse(booking: Booking): CreateBookingResponse {
    return {
      id: booking.id,
      restaurantId: booking.restaurantId,
      sectorId: booking.sectorId,
      tableIds: booking.tableIds,
      partySize: booking.partySize,
      start: booking.start,
      end: booking.end,
      durationMinutes: booking.durationMinutes,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }
}

export default CreateBookingUseCase;
