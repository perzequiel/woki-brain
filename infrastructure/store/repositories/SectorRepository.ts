import Sector from '../../../domain/entities/sector';
import { SectorRepository } from '../../../domain/interfaces/repositories';

/**
 * In-memory implementation of SectorRepository.
 * Uses a Map for storage.
 */
class InMemorySectorRepository implements SectorRepository {
  private readonly store: Map<string, Sector>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Finds a sector by ID.
   *
   * @param id - Sector ID
   * @returns Sector if found, null otherwise
   */
  public async findById(id: string): Promise<Sector | null> {
    // Lint fix: add await for async method (simulate possible async retrieval)
    const sector = this.store.get(id) || null;
    return Promise.resolve(sector);
  }

  /**
   * Finds all sectors for a restaurant.
   *
   * @param restaurantId - Restaurant ID
   * @returns Array of sectors
   */
  public async findByRestaurantId(restaurantId: string): Promise<Sector[]> {
    // Lint fix: add await for async method (simulate possible async retrieval)
    const sectors = Array.from(this.store.values()).filter(
      (sector) => sector.restaurantId === restaurantId
    );
    return Promise.resolve(sectors);
  }

  /**
   * Saves a sector (for seeding/testing).
   *
   * @param sector - Sector to save
   */
  public async save(sector: Sector): Promise<void> {
    // Lint fix: add await for async method (simulate possible async storage)
    this.store.set(sector.id, sector);
    return Promise.resolve();
  }

  /**
   * Gets all sectors (for testing/debugging).
   *
   * @returns Array of all sectors
   */
  public async findAll(): Promise<Sector[]> {
    // Lint fix: add await for async method (simulate possible async retrieval)
    const sectors = Array.from(this.store.values());
    return Promise.resolve(sectors);
  }

  /**
   * Clears all sectors (for testing).
   */
  public async clear(): Promise<void> {
    // Lint fix: add await for async method (simulate possible async storage)
    this.store.clear();
    return Promise.resolve();
  }
}

export default InMemorySectorRepository;
