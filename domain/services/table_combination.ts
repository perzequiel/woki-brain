import Table from '../entities/table';

/**
 * Represents a possible grouping of tables that can accommodate a party,
 * along with the "waste" (unused seats).
 *
 * @property tableIds - Array of table IDs that form the combination
 * @property waste - Number of unused seats (maxCapacity - people)
 */
export interface TableCombination {
  tableIds: string[];
  waste: number;
}

/**
 * Service that finds the optimal combination of tables to accommodate a party.
 *
 * **Purpose:** This service finds table combinations based on CAPACITY only (not temporal availability).
 * It is a pure domain service for selecting tables by their capacity ranges.
 *
 * **Note:** This service does NOT consider:
 * - Time gaps or availability
 * - Existing bookings
 * - Service windows
 * - Temporal constraints
 *
 * For temporal gap discovery with bookings, use:
 * - `GapDiscoveryService` for single tables
 * - `ComboIntersectionService` for combo gaps
 * - `DiscoverSeatsUseCase` for the full discovery flow
 *
 * Algorithm Overview:
 * 1. For each table, check if it can be the starting table (people >= table.minSize)
 * 2. If a table alone can accommodate (people <= table.maxSize), add it as a candidate
 * 3. If not, try to find additional tables sequentially to complete the combination
 * 4. Store all valid combinations with their waste (unused seats)
 * 5. Select the combination with minimum waste
 *
 * Limitations:
 * - Only explores sequential combinations (table[i] + table[i+1] + ...)
 * - Does not explore all possible combinations (e.g., t[0] + t[2] skipping t[1]) assuming that people want to be seated together
 */
class TableCombinationService {
  private readonly tables: Table[];

  constructor(tables: Table[]) {
    this.tables = tables;
  }

  /**
   * Finds the optimal table combination for the given number of people.
   *
   * @param people - Number of people to accommodate
   * @returns TableCombination with the best table combination and its waste
   */
  public execute(people: number): TableCombination {
    // Map to store all valid combinations: key = array of table IDs, value = waste
    const validCombinations = new Map<[string, ...string[]], number>();

    for (let tableIndex = 0; tableIndex < this.tables.length; tableIndex++) {
      const currentTable = this.tables[tableIndex];

      if (people >= currentTable.minSize) {
        // Calculate how many people remain after using this table at max capacity
        const remainingPeople = people - currentTable.maxSize;

        // Case 1: This table alone can accommodate all people
        if (remainingPeople <= 0) {
          // Calculate minimum waste: we can use minimum capacity needed
          // Waste = maxSize - people (minimum waste when using maxSize)
          // But we could use less if people is closer to minSize
          const waste = this.calculateMinimumWaste([currentTable], people);
          validCombinations.set([currentTable.id], waste);
        } else {
          // Case 2: Need additional tables - search for combinations starting from next table
          this.findCombinationsStartingWithTable(
            tableIndex,
            currentTable.id,
            people, // Pass total people for waste calculation
            validCombinations
          );
        }
      }
      // If people < table.minSize, skip this table (cannot use it)
    }

    // Select the combination with minimum waste
    return this.selectBestCombination(validCombinations);
  }

  /**
   * Finds all valid table combinations that start with a specific table.
   *
   * Algorithm:
   * - Starts searching from the next table (tableIndex + 1)
   * - Sequentially adds tables and checks if the combination can accommodate all people
   * - When a valid combination is found, stores it and continues searching
   *   to find other combinations starting with the same initial table
   *
   * Example: If we start with T1 and need 4 people:
   * - T1(2-3) + T2(2-3): totalMinSize=4, totalMaxSize=6 → Found T1+T2 (waste: 0)
   * - Continue: T1(2-3) + T2(2-3) + T3(2-2): totalMinSize=6, totalMaxSize=8 → Found T1+T2+T3
   *
   * @param startTableIndex - Index of the initial table in the combination
   * @param initialTableId - ID of the initial table
   * @param totalPeople - Total number of people to accommodate
   * @param validCombinations - Map to store found combinations
   */
  private findCombinationsStartingWithTable(
    startTableIndex: number,
    initialTableId: string,
    totalPeople: number,
    validCombinations: Map<[string, ...string[]], number>
  ): void {
    // Only search if there are more tables after the current one
    if (startTableIndex + 1 >= this.tables.length) {
      return;
    }

    const initialTable = this.tables.find((t) => t.id === initialTableId)!;
    const additionalTableIds: string[] = [];

    // Search through remaining tables sequentially
    for (
      let nextTableIndex = startTableIndex + 1;
      nextTableIndex < this.tables.length;
      nextTableIndex++
    ) {
      const nextTable = this.tables[nextTableIndex];

      // Add this table to the combination
      additionalTableIds.push(nextTable.id);

      // Check if the total combination can accommodate all people
      const combinationTables = [
        initialTable,
        ...additionalTableIds.map((id) => this.tables.find((t) => t.id === id)!),
      ];
      // const totalMinSize = combinationTables.reduce((sum, table) => sum + table.minSize, 0);
      const totalMaxSize = combinationTables.reduce((sum, table) => sum + table.maxSize, 0);

      // If the combination can accommodate all people (people <= maxSize)
      // Note: We allow people < minSize because we can use less capacity if needed
      // The waste will be calculated based on maxSize
      if (totalPeople <= totalMaxSize) {
        // Found a valid combination: initialTable + additionalTables
        const combinationTableIds: [string, ...string[]] = [initialTableId, ...additionalTableIds];
        // Calculate minimum waste considering we can use minimum capacity
        const waste = this.calculateMinimumWaste(combinationTables, totalPeople);
        validCombinations.set(combinationTableIds, waste);

        // Continue searching for other combinations (don't reset)
        // This allows finding: T1+T2, T1+T2+T3, etc.
      }

      // If max capacity is already more than needed, we can stop adding tables
      // (but continue to check if this combination is valid)
      // If max capacity is less than needed, continue adding more tables
    }
  }

  /**
   * Calculates the minimum waste possible for a combination of tables.
   *
   * The waste represents unused seats when using the maximum available capacity.
   * It's calculated as: maxSize - people
   *
   * Note: Even if we can use minimum capacity (people <= totalMinSize),
   * the waste is still calculated based on maximum capacity to represent
   * the potential unused seats available.
   *
   * Algorithm:
   * - Calculate total maxSize of the combination
   * - Waste = totalMaxSize - people
   *
   * @param tables - Array of tables in the combination
   * @param people - Number of people to accommodate
   * @returns Waste (unused seats) for this combination
   */
  private calculateMinimumWaste(tables: Table[], people: number): number {
    const totalMaxSize = tables.reduce((sum, table) => sum + table.maxSize, 0);

    // Waste = maximum available capacity - people
    // This represents unused seats when using maximum capacity
    return totalMaxSize - people;
  }

  /**
   * Selects the best combination from all valid combinations.
   *
   * Selection criteria:
   * - Minimum waste (unused seats)
   * - If multiple combinations have the same waste, returns the first one found
   *
   * @param validCombinations - Map of all valid table combinations
   * @returns Com with the best combination
   */
  private selectBestCombination(
    validCombinations: Map<[string, ...string[]], number>
  ): TableCombination {
    // If no valid combinations found, return empty result
    if (validCombinations.size === 0) {
      return {
        tableIds: [],
        waste: Infinity,
      };
    }

    // Convert Map entries to an array of combination objects for easier processing
    const combinations: Array<{ tableIds: string[]; waste: number }> = Array.from(
      validCombinations.entries()
    ).map(([tableIds, waste]) => ({
      tableIds: [...tableIds],
      waste,
    }));

    // Sort combinations by waste (ascending) to find the one with minimum waste
    combinations.sort((a, b) => a.waste - b.waste);

    // Select the combination with the lowest waste (first in sorted array)
    const bestCombination = combinations[0];

    return {
      tableIds: bestCombination.tableIds,
      waste: bestCombination.waste,
    };
  }
}

export default TableCombinationService;
