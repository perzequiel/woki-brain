import Booking from '../entities/booking';
import Restaurant from '../entities/restaurant';
import Sector from '../entities/sector';
import Table from '../entities/table';

/**
 * Repository interfaces (ports) for domain layer.
 * Implementations should be in infrastructure layer.
 */

export interface RestaurantRepository {
  findById(id: string): Promise<Restaurant | null>;
}

export interface SectorRepository {
  findByRestaurantId(restaurantId: string): Promise<Sector[]>;
  findById(id: string): Promise<Sector | null>;
}

export interface TableRepository {
  findBySectorId(sectorId: string): Promise<Table[]>;
  findById(id: string): Promise<Table | null>;
}

export interface BookingRepository {
  findByRestaurantAndDate(restaurantId: string, date: string): Promise<Booking[]>;
  findByTableAndDate(tableIds: string[], date: string): Promise<Booking[]>;
  save(booking: Booking): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
}
