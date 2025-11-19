import Booking from '../../domain/entities/booking';
import Table from '../../domain/entities/table';
import CandidateBuilder from '../../domain/services/candidate_builder';
import { findComboGaps } from '../../domain/services/combo_intersection';
import GapDiscoveryService from '../../domain/services/gap_discovery';
import WokiBrainService, { Candidate, WokiBrainResult } from '../../domain/services/wokibrain';

/**
 * Input for the Discover Seats use case
 */
export interface DiscoverSeatsInput {
  tables: Table[];
  bookings: Booking[];
  date: string; // YYYY-MM-DD
  partySize: number;
  durationMinutes: number;
  serviceWindows?: Array<{ start: string; end: string }>;
  timezone: string;
  windowStart?: string; // Optional: HH:mm
  windowEnd?: string; // Optional: HH:mm
  limit?: number; // Optional: max candidates to return (default: 10)
}

/**
 * Candidate response for API
 */
export interface DiscoverCandidate {
  kind: 'single' | 'combo';
  tableIds: string[];
  start: string; // ISO8601
  end: string; // ISO8601
  score?: number;
  rationale?: string;
}

/**
 * Response from Discover Seats use case
 */
export interface DiscoverSeatsResponse {
  slotMinutes: number;
  durationMinutes: number;
  candidates: DiscoverCandidate[];
}

/**
 * Discover Seats Use Case
 *
 * Orchestrates the discovery of available seating options for a party.
 * This use case coordinates:
 * - Gap discovery for individual tables
 * - Combo gap intersection
 * - Candidate building
 * - WokiBrain selection strategy
 *
 * Returns candidates sorted by WokiBrain strategy.
 */
class DiscoverSeatsUseCase {
  private readonly gapService: GapDiscoveryService;
  private readonly wokiBrainService: WokiBrainService;

  constructor() {
    this.gapService = new GapDiscoveryService();
    this.wokiBrainService = new WokiBrainService();
  }

  /**
   * Discovers available seating options for a party.
   *
   * @param input - Discover input parameters
   * @returns DiscoverSeatsResponse with candidates sorted by WokiBrain strategy
   */
  public execute(input: DiscoverSeatsInput): DiscoverSeatsResponse {
    const {
      tables,
      bookings,
      date,
      partySize,
      durationMinutes,
      serviceWindows,
      timezone,
      windowStart,
      windowEnd,
      limit = 10,
    } = input;

    // Step 1: Find gaps for all single tables
    const singleCandidates = this.findSingleTableCandidates(
      tables,
      bookings,
      date,
      partySize,
      durationMinutes,
      serviceWindows,
      timezone,
      windowStart,
      windowEnd
    );

    // Step 2: Find gaps for all possible combos (2, 3, ... tables)
    const comboCandidates = this.findComboCandidates(
      tables,
      bookings,
      date,
      partySize,
      durationMinutes,
      serviceWindows,
      timezone,
      windowStart,
      windowEnd
    );

    // Step 3: Combine all candidates
    const allCandidates = [...singleCandidates, ...comboCandidates];

    // Step 4: Filter by capacity and apply WokiBrain selection
    const validCandidates = this.filterAndSortCandidates(allCandidates, partySize);

    // Step 5: Limit results and convert to API format
    const limitedCandidates = validCandidates.slice(0, limit);
    const apiCandidates = this.convertToApiFormat(limitedCandidates);

    return {
      slotMinutes: 15,
      durationMinutes,
      candidates: apiCandidates,
    };
  }

  /**
   * Finds candidates for single tables.
   */
  private findSingleTableCandidates(
    tables: Table[],
    bookings: Booking[],
    date: string,
    partySize: number,
    durationMinutes: number,
    serviceWindows: Array<{ start: string; end: string }> | undefined,
    timezone: string,
    windowStart?: string,
    windowEnd?: string
  ): Candidate[] {
    const candidates: Candidate[] = [];

    for (const table of tables) {
      // Check if table can accommodate party size
      if (partySize < table.minSize || partySize > table.maxSize) {
        continue;
      }

      // Apply window filter if provided
      const filteredWindows = this.applyTimeWindow(serviceWindows, windowStart, windowEnd);

      // Find gaps for this table
      const gaps = this.gapService.findGapsForTable({
        table,
        bookings,
        date,
        durationMinutes,
        serviceWindows: filteredWindows,
        timezone,
      });

      // Create candidate for each gap
      for (const gap of gaps) {
        const candidate = CandidateBuilder.createSingleCandidate(table, gap, partySize);
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  /**
   * Finds candidates for table combinations.
   * Explores combinations of 2, 3, ... up to all tables.
   */
  private findComboCandidates(
    tables: Table[],
    bookings: Booking[],
    date: string,
    partySize: number,
    durationMinutes: number,
    serviceWindows: Array<{ start: string; end: string }> | undefined,
    timezone: string,
    windowStart?: string,
    windowEnd?: string
  ): Candidate[] {
    const candidates: Candidate[] = [];

    // Apply window filter if provided
    const filteredWindows = this.applyTimeWindow(serviceWindows, windowStart, windowEnd);

    // Explore combinations of 2, 3, ... tables
    // Optimization: Only explore combinations where sum(maxSize) >= partySize
    for (let comboSize = 2; comboSize <= tables.length; comboSize++) {
      const combinations = this.generateCombinations(tables, comboSize);

      for (const combo of combinations) {
        // Quick check: can this combo accommodate the party?
        const totalMinSize = combo.reduce((sum, t) => sum + t.minSize, 0);
        const totalMaxSize = combo.reduce((sum, t) => sum + t.maxSize, 0);

        if (partySize < totalMinSize || partySize > totalMaxSize) {
          continue;
        }

        // Find combo gaps (intersected)
        const comboGaps = findComboGaps(
          combo,
          bookings,
          date,
          durationMinutes,
          filteredWindows,
          timezone
        );

        // Create candidate for each gap
        for (const gap of comboGaps) {
          const candidate = CandidateBuilder.createComboCandidate(combo, gap, partySize);
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  /**
   * Generates all combinations of size N from tables array.
   * Uses sequential combinations (assumes tables want to be seated together).
   */
  private generateCombinations(tables: Table[], size: number): Table[][] {
    const combinations: Table[][] = [];

    for (let i = 0; i <= tables.length - size; i++) {
      const combination = tables.slice(i, i + size);
      combinations.push(combination);
    }

    return combinations;
  }

  /**
   * Applies time window filter to service windows.
   * If windowStart/windowEnd are provided, filters and clips service windows to only include
   * the portion that overlaps with the requested window.
   */
  private applyTimeWindow(
    serviceWindows: Array<{ start: string; end: string }> | undefined,
    windowStart?: string,
    windowEnd?: string
  ): Array<{ start: string; end: string }> | undefined {
    if (!serviceWindows || (!windowStart && !windowEnd)) {
      return serviceWindows;
    }

    // Filter and clip service windows to requested window
    return serviceWindows
      .filter((window) => {
        // Check if window overlaps with requested window
        if (windowStart && window.end <= windowStart) {
          return false; // Service window ends before requested start
        }
        if (windowEnd && window.start >= windowEnd) {
          return false; // Service window starts after requested end
        }
        return true; // Overlaps
      })
      .map((window) => {
        // Clip window to requested bounds
        const clippedStart = windowStart && window.start < windowStart ? windowStart : window.start;
        const clippedEnd = windowEnd && window.end > windowEnd ? windowEnd : window.end;
        return { start: clippedStart, end: clippedEnd };
      });
  }

  /**
   * Filters candidates by capacity and sorts using WokiBrain strategy.
   */
  private filterAndSortCandidates(candidates: Candidate[], partySize: number): Candidate[] {
    // Filter valid candidates
    const validCandidates = candidates.filter((candidate) => {
      return partySize >= candidate.capacity.minSize && partySize <= candidate.capacity.maxSize;
    });

    // Sort using WokiBrain strategy (same logic as WokiBrainService)
    return validCandidates.sort((a, b) => {
      // 1. Prefer single over combo
      if (a.kind === 'single' && b.kind === 'combo') {
        return -1;
      }
      if (a.kind === 'combo' && b.kind === 'single') {
        return 1;
      }

      // 2. Prefer fewer tables
      if (a.tableIds.length !== b.tableIds.length) {
        return a.tableIds.length - b.tableIds.length;
      }

      // 3. Minimize waste
      if (a.waste !== b.waste) {
        return a.waste - b.waste;
      }

      // 4. Earliest gap
      return a.gap.start.getTime() - b.gap.start.getTime();
    });
  }

  /**
   * Converts candidates to API format.
   */
  private convertToApiFormat(candidates: Candidate[]): DiscoverCandidate[] {
    return candidates.map((candidate) => ({
      kind: candidate.kind,
      tableIds: candidate.tableIds,
      start: candidate.gap.start.toISOString(),
      end: candidate.gap.end.toISOString(),
      score: candidate.score,
      rationale: candidate.rationale,
    }));
  }

  /**
   * Selects the best candidate using WokiBrain strategy.
   * This is a convenience method that wraps WokiBrainService.
   *
   * @param candidates - All candidates
   * @param partySize - Number of people
   * @returns Best candidate or null
   */
  public selectBest(candidates: Candidate[], partySize: number): WokiBrainResult {
    return this.wokiBrainService.selectBest({ candidates, partySize });
  }
}

export default DiscoverSeatsUseCase;
