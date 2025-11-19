import { expect, suite, test } from 'vitest';
import Booking from '../../domain/entities/booking';
import Restaurant from '../../domain/entities/restaurant';
import Sector from '../../domain/entities/sector';
import Table from '../../domain/entities/table';
import { isISODateTime } from '../../domain/services/time';

suite('Entities Creation', () => {
  test('Create a Table Entity', () => {
    const table = Table.create({
      id: '1',
      sectorId: '1',
      name: 'Table 1',
      minSize: 2,
      maxSize: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(table).toBeDefined();
    expect(table.id).toBe('1');
    expect(table.sectorId).toBe('1');
    expect(table.name).toBe('Table 1');
    expect(table.minSize).toBe(2);
    expect(table.maxSize).toBe(4);
    expect(isISODateTime(table.createdAt)).toBe(true);
    expect(isISODateTime(table.updatedAt)).toBe(true);
  });
  test('Create a Sector Entity', () => {
    const sector = Sector.create({
      id: '1',
      restaurantId: '1',
      name: 'Sector 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(sector).toBeDefined();
    expect(sector.id).toBe('1');
    expect(sector.restaurantId).toBe('1');
    expect(sector.name).toBe('Sector 1');
    expect(isISODateTime(sector.createdAt)).toBe(true);
    expect(isISODateTime(sector.updatedAt)).toBe(true);
  });
  test('Create a Restaurant Entity', () => {
    const restaurant = Restaurant.create({
      id: '1',
      name: 'Restaurant 1',
      timezone: 'America/New_York',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(restaurant).toBeDefined();
    expect(restaurant.id).toBe('1');
    expect(restaurant.name).toBe('Restaurant 1');
    expect(restaurant.timezone).toBe('America/New_York');
    expect(isISODateTime(restaurant.createdAt)).toBe(true);
    expect(isISODateTime(restaurant.updatedAt)).toBe(true);
  });
  test('Create a Booking Entity', () => {
    const booking = Booking.create({
      id: '1',
      restaurantId: '1',
      sectorId: '1',
      tableIds: ['1'],
      partySize: 2,
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      durationMinutes: 30,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(booking).toBeDefined();
    expect(booking.id).toBe('1');
    expect(booking.restaurantId).toBe('1');
    expect(booking.sectorId).toBe('1');
    expect(booking.tableIds).toEqual(['1']);
    expect(booking.partySize).toBe(2);
    expect(isISODateTime(booking.createdAt)).toBe(true);
    expect(isISODateTime(booking.updatedAt)).toBe(true);
  });
});
