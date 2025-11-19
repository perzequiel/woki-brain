import { z } from 'zod';

/**
 * Schema for GET /woki/discover query parameters
 */
export const DiscoverQuerySchema = z.object({
  restaurantId: z.string().min(1, 'restaurantId is required'),
  sectorId: z.string().min(1, 'sectorId is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
  partySize: z.coerce.number().int().positive('partySize must be a positive integer'),
  duration: z.coerce
    .number()
    .int()
    .positive('duration must be a positive integer')
    .refine((val) => val % 15 === 0, 'duration must be a multiple of 15')
    .refine((val) => val >= 30 && val <= 180, 'duration must be between 30 and 180 minutes'),
  windowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'windowStart must be in HH:mm format')
    .optional(),
  windowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'windowEnd must be in HH:mm format')
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});

export type DiscoverQuery = z.infer<typeof DiscoverQuerySchema>;
