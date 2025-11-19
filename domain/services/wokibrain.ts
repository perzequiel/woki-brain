import { TimeGap } from './gap_discovery';

/**
 * Represents a candidate for seating a party.
 * Can be a single table or a combination of tables.
 */
export interface Candidate {
  kind: 'single' | 'combo';
  tableIds: string[];
  gap: TimeGap;
  capacity: {
    minSize: number;
    maxSize: number;
  };
  waste: number; // Unused seats (maxSize - partySize)
  score?: number; // Optional score for ranking
  rationale?: string; // Optional explanation
}

/**
 * Input for WokiBrain selection
 */
export interface WokiBrainInput {
  candidates: Candidate[];
  partySize: number;
}

/**
 * Result of WokiBrain selection
 */
export interface WokiBrainResult {
  candidate: Candidate | null;
  hasCapacity: boolean;
}

/**
 * WokiBrain Selection Service
 *
 * Implements a deterministic selection strategy to choose the best candidate
 * from available single-table and combo options.
 *
 * Selection Strategy:
 * 1. Minimize table count (prefer single over combo)
 * 2. Minimize waste (unused seats)
 * 3. Tie-breaker: earliest gap start time
 *
 * This ensures:
 * - Deterministic: same inputs → same output
 * - Efficient: uses fewer tables when possible
 * - Optimal: minimizes unused capacity
 * - Fair: earlier gaps are preferred
 */
class WokiBrainService {
  /**
   * Selects the best candidate from available options.
   *
   * @param input - WokiBrain input with candidates and party size
   * @returns WokiBrainResult with selected candidate or null if no capacity
   */
  public selectBest(input: WokiBrainInput): WokiBrainResult {
    const { candidates, partySize } = input;

    // Filter candidates that can accommodate the party
    const validCandidates = this.filterValidCandidates(candidates, partySize);

    if (validCandidates.length === 0) {
      return {
        candidate: null,
        hasCapacity: false,
      };
    }

    // Select best candidate using deterministic strategy
    const bestCandidate = this.selectBestCandidate(validCandidates);

    return {
      candidate: bestCandidate,
      hasCapacity: true,
    };
  }

  /**
   * Filters candidates that can accommodate the party size.
   * A candidate is valid if: minSize <= partySize <= maxSize
   *
   * @param candidates - All candidates
   * @param partySize - Number of people
   * @returns Valid candidates that can accommodate the party
   */
  private filterValidCandidates(candidates: Candidate[], partySize: number): Candidate[] {
    return candidates.filter((candidate) => {
      return partySize >= candidate.capacity.minSize && partySize <= candidate.capacity.maxSize;
    });
  }

  /**
   * Selects the best candidate using deterministic strategy.
   *
   * Selection criteria (in order of priority):
   * 1. Minimize table count (prefer single over combo)
   * 2. Minimize waste (unused seats)
   * 3. Tie-breaker: earliest gap start time
   *
   * @param candidates - Valid candidates to choose from
   * @returns Best candidate
   */
  private selectBestCandidate(candidates: Candidate[]): Candidate {
    // Sort candidates by selection criteria
    const sorted = [...candidates].sort((a, b) => {
      // 1. Prefer single over combo
      if (a.kind === 'single' && b.kind === 'combo') {
        return -1;
      }
      if (a.kind === 'combo' && b.kind === 'single') {
        return 1;
      }

      // 2. If both same kind, prefer fewer tables
      if (a.tableIds.length !== b.tableIds.length) {
        return a.tableIds.length - b.tableIds.length;
      }

      // 3. Minimize waste (unused seats)
      if (a.waste !== b.waste) {
        return a.waste - b.waste;
      }

      // 4. Tie-breaker: earliest gap start time
      return a.gap.start.getTime() - b.gap.start.getTime();
    });

    return sorted[0];
  }

  /**
   * Calculates waste (unused seats) for a candidate.
   *
   * @param candidate - Candidate to calculate waste for
   * @param partySize - Number of people
   * @returns Waste (unused seats)
   */
  public static calculateWaste(candidate: Candidate, partySize: number): number {
    return candidate.capacity.maxSize - partySize;
  }
}

export default WokiBrainService;
