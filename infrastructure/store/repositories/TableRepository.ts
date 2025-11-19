import Table from '../../../domain/entities/table';
import { TableRepository } from '../../../domain/interfaces/repositories';

/**
 * In-memory implementation of TableRepository.
 * Uses a Map for storage.
 */
class InMemoryTableRepository implements TableRepository {
  private readonly store: Map<string, Table>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Finds a table by ID.
   *
   * @param id - Table ID
   * @returns Table if found, null otherwise
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async findById(id: string): Promise<Table | null> {
    return this.store.get(id) || null;
  }

  /**
   * Finds all tables for a sector.
   *
   * @param sectorId - Sector ID
   * @returns Array of tables
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async findBySectorId(sectorId: string): Promise<Table[]> {
    return Array.from(this.store.values()).filter((table) => table.sectorId === sectorId);
  }

  /**
   * Saves a table (for seeding/testing).
   *
   * @param table - Table to save
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async save(table: Table): Promise<void> {
    this.store.set(table.id, table);
  }

  /**
   * Gets all tables (for testing/debugging).
   *
   * @returns Array of all tables
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async findAll(): Promise<Table[]> {
    return Array.from(this.store.values());
  }

  /**
   * Clears all tables (for testing).
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async clear(): Promise<void> {
    this.store.clear();
  }
}

export default InMemoryTableRepository;
