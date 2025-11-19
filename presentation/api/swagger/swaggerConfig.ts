import swaggerJsdoc from 'swagger-jsdoc';
import type { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'WokiBrain API',
    version: '1.0.0',
    description:
      'WokiBrain booking engine API - Discover seats, create bookings, and list bookings',
    contact: {
      name: 'WokiBrain',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Discover',
      description: 'Discover available seating options',
    },
    {
      name: 'Bookings',
      description: 'Manage bookings',
    },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error code',
            example: 'invalid_input',
          },
          detail: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'Invalid input parameters',
          },
        },
        required: ['error', 'detail'],
      },
      DiscoverCandidate: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['single', 'combo'],
            description: 'Type of candidate (single table or combination)',
          },
          tableIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Table IDs for this candidate',
            example: ['T4'],
          },
          start: {
            type: 'string',
            format: 'date-time',
            description: 'Start time in ISO8601 format',
            example: '2025-10-22T20:00:00-03:00',
          },
          end: {
            type: 'string',
            format: 'date-time',
            description: 'End time in ISO8601 format',
            example: '2025-10-22T21:30:00-03:00',
          },
          score: {
            type: 'number',
            description: 'Optional selection score',
            example: 0.95,
          },
          rationale: {
            type: 'string',
            description: 'Optional selection rationale',
            example: 'Minimal waste, single table',
          },
        },
        required: ['kind', 'tableIds', 'start', 'end'],
      },
      DiscoverResponse: {
        type: 'object',
        properties: {
          slotMinutes: {
            type: 'number',
            description: 'Time slot granularity in minutes',
            example: 15,
          },
          durationMinutes: {
            type: 'number',
            description: 'Requested duration in minutes',
            example: 90,
          },
          candidates: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DiscoverCandidate',
            },
          },
        },
        required: ['slotMinutes', 'durationMinutes', 'candidates'],
      },
      Booking: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
            example: 'BK_001',
          },
          restaurantId: {
            type: 'string',
            description: 'Restaurant ID',
            example: 'R1',
          },
          sectorId: {
            type: 'string',
            description: 'Sector ID',
            example: 'S1',
          },
          tableIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Table IDs for this booking',
            example: ['T4'],
          },
          partySize: {
            type: 'number',
            description: 'Number of people',
            example: 5,
          },
          start: {
            type: 'string',
            format: 'date-time',
            description: 'Start time in ISO8601 format',
            example: '2025-10-22T20:00:00-03:00',
          },
          end: {
            type: 'string',
            format: 'date-time',
            description: 'End time in ISO8601 format',
            example: '2025-10-22T21:30:00-03:00',
          },
          durationMinutes: {
            type: 'number',
            description: 'Duration in minutes',
            example: 90,
          },
          status: {
            type: 'string',
            enum: ['CONFIRMED', 'CANCELLED'],
            description: 'Booking status',
            example: 'CONFIRMED',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp in ISO8601 format',
            example: '2025-10-22T19:50:21-03:00',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp in ISO8601 format',
            example: '2025-10-22T19:50:21-03:00',
          },
        },
        required: [
          'id',
          'restaurantId',
          'sectorId',
          'tableIds',
          'partySize',
          'start',
          'end',
          'durationMinutes',
          'status',
          'createdAt',
          'updatedAt',
        ],
      },
      BookingItem: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
            example: 'BK_001',
          },
          tableIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Table IDs for this booking',
            example: ['T4'],
          },
          partySize: {
            type: 'number',
            description: 'Number of people',
            example: 5,
          },
          start: {
            type: 'string',
            format: 'date-time',
            description: 'Start time in ISO8601 format',
            example: '2025-10-22T20:00:00-03:00',
          },
          end: {
            type: 'string',
            format: 'date-time',
            description: 'End time in ISO8601 format',
            example: '2025-10-22T21:30:00-03:00',
          },
          status: {
            type: 'string',
            enum: ['CONFIRMED', 'CANCELLED'],
            description: 'Booking status',
            example: 'CONFIRMED',
          },
        },
        required: ['id', 'tableIds', 'partySize', 'start', 'end', 'status'],
      },
      ListBookingsResponse: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            description: 'Date in YYYY-MM-DD format',
            example: '2025-10-22',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/BookingItem',
            },
          },
        },
        required: ['date', 'items'],
      },
      CreateBookingRequest: {
        type: 'object',
        properties: {
          restaurantId: {
            type: 'string',
            description: 'Restaurant ID',
            example: 'R1',
          },
          sectorId: {
            type: 'string',
            description: 'Sector ID',
            example: 'S1',
          },
          partySize: {
            type: 'number',
            description: 'Number of people',
            example: 5,
            minimum: 1,
          },
          durationMinutes: {
            type: 'number',
            description: 'Duration in minutes (multiple of 15, between 30 and 180)',
            example: 90,
            minimum: 30,
            maximum: 180,
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Date in YYYY-MM-DD format',
            example: '2025-10-22',
          },
          windowStart: {
            type: 'string',
            pattern: '^\\d{2}:\\d{2}$',
            description: 'Optional start time window in HH:mm format',
            example: '20:00',
          },
          windowEnd: {
            type: 'string',
            pattern: '^\\d{2}:\\d{2}$',
            description: 'Optional end time window in HH:mm format',
            example: '23:45',
          },
        },
        required: ['restaurantId', 'sectorId', 'partySize', 'durationMinutes', 'date'],
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./presentation/api/routers/*.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);
