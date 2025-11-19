import { z } from 'zod';

/**
 * Schema for POST /woki/bookings request body
 */
export const CreateBookingBodySchema = z.object({
  restaurantId: z.string().min(1, 'restaurantId is required'),
  sectorId: z.string().min(1, 'sectorId is required'),
  partySize: z.number().int().positive('partySize must be a positive integer'),
  durationMinutes: z
    .number()
    .int()
    .positive('durationMinutes must be a positive integer')
    .refine((val) => val % 15 === 0, 'durationMinutes must be a multiple of 15')
    .refine((val) => val >= 30 && val <= 180, 'durationMinutes must be between 30 and 180 minutes'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  windowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'windowStart must be in HH:mm format')
    .optional(),
  windowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'windowEnd must be in HH:mm format')
    .optional(),
});

export type CreateBookingBody = z.infer<typeof CreateBookingBodySchema>;

/**
 * Schema for GET /woki/bookings/day query parameters
 */
export const ListBookingsQuerySchema = z.object({
  restaurantId: z.string().min(1, 'restaurantId is required'),
  sectorId: z.string().min(1, 'sectorId is required').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
});

export type ListBookingsQuery = z.infer<typeof ListBookingsQuerySchema>;
