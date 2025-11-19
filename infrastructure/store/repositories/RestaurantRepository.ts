import Restaurant from '../../../domain/entities/restaurant';
import { RestaurantRepository } from '../../../domain/interfaces/repositories';

/**
 * In-memory implementation of RestaurantRepository.
 * Uses a Map for storage.
 */
class InMemoryRestaurantRepository implements RestaurantRepository {
  private readonly store: Map<string, Restaurant>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Finds a restaurant by ID.
   *
   * @param id - Restaurant ID
   * @returns Restaurant if found, null otherwise
   */
  public async findById(id: string): Promise<Restaurant | null> {
    return this.store.get(id) || null;
  }

  /**
   * Saves a restaurant (for seeding/testing).
   *
   * @param restaurant - Restaurant to save
   */
  public async save(restaurant: Restaurant): Promise<void> {
    this.store.set(restaurant.id, restaurant);
  }

  /**
   * Gets all restaurants (for testing/debugging).
   *
   * @returns Array of all restaurants
   */
  public async findAll(): Promise<Restaurant[]> {
    return Array.from(this.store.values());
  }

  /**
   * Clears all restaurants (for testing).
   */
  public async clear(): Promise<void> {
    this.store.clear();
  }
}

export default InMemoryRestaurantRepository;
