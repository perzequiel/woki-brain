import Table from '../entities/table';
import { TimeGap } from './gap_discovery';
import { Candidate } from './wokibrain';

/**
 * Candidate Builder Service
 *
 * Responsible for constructing Candidate objects from tables and gaps.
 * This service handles the creation logic, separating it from selection logic.
 */
class CandidateBuilder {
  /**
   * Creates a candidate from a single table and gap.
   *
   * @param table - Table
   * @param gap - Time gap
   * @param partySize - Number of people
   * @returns Candidate object
   */
  public static createSingleCandidate(table: Table, gap: TimeGap, partySize: number): Candidate {
    const capacity = {
      minSize: table.minSize,
      maxSize: table.maxSize,
    };
    const waste = capacity.maxSize - partySize;

    return {
      kind: 'single',
      tableIds: [table.id],
      gap,
      capacity,
      waste,
    };
  }

  /**
   * Creates a candidate from a combination of tables and gap.
   * Uses the Simple Sum heuristic to calculate combo capacity.
   *
   * @param tables - Array of tables in the combination
   * @param gap - Time gap (intersected)
   * @param partySize - Number of people
   * @returns Candidate object
   */
  public static createComboCandidate(tables: Table[], gap: TimeGap, partySize: number): Candidate {
    // Calculate combo capacity using simple sum heuristic
    const capacity = {
      minSize: tables.reduce((sum, table) => sum + table.minSize, 0),
      maxSize: tables.reduce((sum, table) => sum + table.maxSize, 0),
    };
    const waste = capacity.maxSize - partySize;

    return {
      kind: 'combo',
      tableIds: tables.map((table) => table.id),
      gap,
      capacity,
      waste,
    };
  }
}

export default CandidateBuilder;
