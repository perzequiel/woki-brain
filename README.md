# WokiBrain - Booking Engine

A compact booking engine for restaurants that discovers **when** and **how** to seat a party using single tables or table combinations.

## Features

- ✅ Temporal gap discovery for time-based availability
- ✅ Table combination support (combos of any size)
- ✅ Deterministic selection strategy (WokiBrain)
- ✅ Concurrency handling (no double booking)
- ✅ Idempotency support
- ✅ Structured logging with Pino

---

## Combo Capacity Heuristic

### Choice: **Simple Sums**

We use a **simple sum** approach to calculate the capacity range for any combination of tables.

#### Formula

For a combination of tables `T₁, T₂, ..., Tₙ`:

```
minSize(combo) = Σ minSize(Tᵢ)
maxSize(combo) = Σ maxSize(Tᵢ)
```

Where:

- `minSize(Tᵢ)` = minimum capacity of table `Tᵢ`
- `maxSize(Tᵢ)` = maximum capacity of table `Tᵢ`

#### Example

Given tables:

- `T1`: minSize=2, maxSize=4
- `T2`: minSize=2, maxSize=3
- `T3`: minSize=1, maxSize=2

Combination `T1 + T2 + T3`:

- `minSize = 2 + 2 + 1 = 5`
- `maxSize = 4 + 3 + 2 = 9`
- Capacity range: **5-9 people**

#### Rationale

**Why Simple Sums?**

1. **Simplicity**: Easy to understand, implement, and test
2. **Predictability**: Clear capacity calculation without hidden penalties
3. **Flexibility**: Allows maximum utilization of available tables
4. **Real-world accuracy**: When combining tables, the total capacity is indeed the sum of individual capacities

**Trade-offs:**

- ✅ **Pros**: Simple, predictable, maximizes capacity utilization
- ⚠️ **Cons**: Doesn't account for physical constraints (e.g., tables that can't be physically combined, spacing issues)

#### Implementation

The heuristic is implemented directly in the combo candidate building logic:

```typescript
// Calculate total capacity of a combination
const totalMinSize = tables.reduce((sum, table) => sum + table.minSize, 0);
const totalMaxSize = tables.reduce((sum, table) => sum + table.maxSize, 0);
```

This calculation is performed in `domain/services/candidate_builder.ts` when creating combo candidates.

#### Alternative Approaches Considered

1. **Sums minus merge penalties**: Would reduce capacity to account for physical constraints, but adds complexity without clear benefit for in-memory scenarios
2. **Max-of-mins**: Would be too restrictive, potentially rejecting valid combinations
3. **Custom heuristics**: Unnecessary complexity for the current requirements

---

## WokiBrain Selection Strategy

### Choice: **Minimize Table Count + Minimize Waste**

WokiBrain uses a deterministic selection strategy to choose the best candidate from available single-table and combo options.

#### Selection Criteria (in order of priority)

1. **Minimize table count**: Prefer single table over combo
2. **Minimize waste**: Prefer candidates with fewer unused seats
3. **Tie-breaker**: Prefer earliest gap start time

#### Algorithm

```typescript
// Sort candidates by:
1. Kind: single < combo
2. Table count: fewer tables preferred
3. Waste: lower waste preferred
4. Start time: earlier gap preferred
```

#### Example

Given candidates:

- **Single T1**: waste=1, start=20:00
- **Combo T2+T3**: waste=0, start=20:00
- **Single T4**: waste=2, start=21:00

**Selected**: Single T1 (preferred over combo despite higher waste)

Given candidates (all singles):

- **T1**: waste=1, start=20:00
- **T2**: waste=1, start=21:00

**Selected**: T1 (same waste, earlier start)

#### Rationale

**Why this strategy?**

1. **Efficiency**: Using fewer tables maximizes restaurant capacity for other parties
2. **Simplicity**: Easy to understand and implement
3. **Deterministic**: Same inputs always produce same output
4. **Fairness**: Earlier gaps are preferred (first-come-first-served)

**Trade-offs:**

- ✅ **Pros**: Simple, efficient, deterministic, fair
- ⚠️ **Cons**: May not always minimize waste if single table has more waste than optimal combo

#### Implementation

The strategy is implemented in `domain/services/wokibrain.ts`:

```typescript
// Selection priority:
1. kind === 'single' (over 'combo')
2. tableIds.length (fewer is better)
3. waste (lower is better)
4. gap.start (earlier is better)
```

---

## Architecture

### Domain Layer

- `domain/entities/` - Core domain entities (Restaurant, Sector, Table, Booking)
- `domain/services/` - Business logic services
  - `gap_discovery.ts` - Temporal gap discovery for single tables
  - `combo_intersection.ts` - Intersect temporal gaps across multiple tables
  - `candidate_builder.ts` - Build candidate objects with capacity calculation
  - `wokibrain.ts` - Deterministic selection strategy
  - `time.ts` - Time utilities (grid alignment, timezone handling)

### Project Structure

```
project/
├── domain/
│   ├── entities/          # Domain entities
│   └── services/         # Domain services
├── tests/
│   └── unittest/         # Unit tests
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 22+ (see `package.json` engines)
- npm or yarn

### Installation

```bash
npm install
```

### Running the Application

**Development mode (with auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on port 3000 by default (configurable via `PORT` environment variable).

**Access Swagger UI:**

- Open http://localhost:3000/api-docs in your browser

### Available Scripts

```bash
# Development
npm run dev          # Start server with auto-reload (tsx watch)
npm start            # Start server (production mode)

# Testing
npm test             # Run all tests
npm test -- <file>   # Run specific test file

# Code Quality
npm run lint         # Check linting errors
npm run lint:fix     # Fix linting errors automatically
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run type-check   # TypeScript type checking
npm run check        # Run type-check + lint + format-check

# Build
npm run build        # Compile TypeScript to JavaScript
```

### Seed Data

The application automatically loads seed data on startup with:

- **Restaurant R1**: "Bistro Central" (timezone: America/Argentina/Buenos_Aires)
- **Sector S1**: "Main Hall"
- **5 Tables**: T1(2-2), T2(2-4), T3(2-4), T4(4-6), T5(2-2)
- **1 Sample Booking**: T2 booked from 20:30 to 21:15

---

## API Examples

### 1. Discover Available Seats

Find available seating options for a party:

```bash
curl -X 'GET' \
  'http://localhost:3000/woki/discover?restaurantId=R1&sectorId=S1&date=2025-10-22&partySize=5&duration=90' \
  -H 'accept: application/json'
```

**With time window:**

```bash
curl -X 'GET' \
  'http://localhost:3000/woki/discover?restaurantId=R1&sectorId=S1&date=2025-10-22&partySize=5&duration=90&windowStart=20:00&windowEnd=23:45' \
  -H 'accept: application/json'
```

**Response (200):**

```json
{
  "slotMinutes": 15,
  "durationMinutes": 90,
  "candidates": [
    {
      "kind": "single",
      "tableIds": ["T4"],
      "start": "2025-10-22T20:00:00-03:00",
      "end": "2025-10-22T21:30:00-03:00"
    },
    {
      "kind": "combo",
      "tableIds": ["T2", "T3"],
      "start": "2025-10-22T20:15:00-03:00",
      "end": "2025-10-22T21:45:00-03:00"
    }
  ]
}
```

### 2. Create a Booking

Create a new booking (requires `Idempotency-Key` header):

```bash
curl -X 'POST' \
  'http://localhost:3000/woki/bookings' \
  -H 'accept: application/json' \
  -H 'Idempotency-Key: my-unique-key-123' \
  -H 'Content-Type: application/json' \
  -d '{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 5,
  "durationMinutes": 90,
  "date": "2025-10-22",
  "windowStart": "20:00",
  "windowEnd": "23:45"
}'
```

**Response (201):**

```json
{
  "id": "BK_1737547821000_abc123",
  "restaurantId": "R1",
  "sectorId": "S1",
  "tableIds": ["T4"],
  "partySize": 5,
  "start": "2025-10-22T20:00:00-03:00",
  "end": "2025-10-22T21:30:00-03:00",
  "durationMinutes": 90,
  "status": "CONFIRMED",
  "createdAt": "2025-10-22T19:50:21-03:00",
  "updatedAt": "2025-10-22T19:50:21-03:00"
}
```

**Idempotency:** Repeat the same request with the same `Idempotency-Key` to get the same booking:

```bash
# Same request again - returns same booking
curl -X 'POST' \
  'http://localhost:3000/woki/bookings' \
  -H 'accept: application/json' \
  -H 'Idempotency-Key: my-unique-key-123' \
  -H 'Content-Type: application/json' \
  -d '{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 5,
  "durationMinutes": 90,
  "date": "2025-10-22"
}'
```

### 3. List Bookings for a Day

Get all bookings for a restaurant on a specific date:

```bash
curl -X 'GET' \
  'http://localhost:3000/woki/bookings/day?restaurantId=R1&date=2025-10-22' \
  -H 'accept: application/json'
```

**With sector filter:**

```bash
curl -X 'GET' \
  'http://localhost:3000/woki/bookings/day?restaurantId=R1&sectorId=S1&date=2025-10-22' \
  -H 'accept: application/json'
```

**Response (200):**

```json
{
  "date": "2025-10-22",
  "items": [
    {
      "id": "BK_1737547821000_abc123",
      "tableIds": ["T4"],
      "partySize": 5,
      "start": "2025-10-22T20:00:00-03:00",
      "end": "2025-10-22T21:30:00-03:00",
      "status": "CONFIRMED"
    }
  ]
}
```

### Error Responses

**400 - Invalid Input:**

```json
{
  "error": "invalid_input",
  "detail": "duration must be a multiple of 15"
}
```

**404 - Not Found:**

```json
{
  "error": "not_found",
  "detail": "Restaurant not found"
}
```

**409 - No Capacity:**

```json
{
  "error": "no_capacity",
  "detail": "No single or combo gap fits duration within window"
}
```

**422 - Outside Service Window:**

```json
{
  "error": "outside_service_window",
  "detail": "Window does not intersect service hours"
}
```

---

## Architecture

### Clean Architecture Layers

```
project/
├── domain/                    # Pure business logic (no external dependencies)
│   ├── entities/             # Domain entities (Restaurant, Sector, Table, Booking)
│   ├── services/              # Business logic services
│   │   ├── gap_discovery.ts  # Temporal gap discovery for single tables
│   │   ├── combo_intersection.ts  # Intersect gaps across multiple tables
│   │   ├── candidate_builder.ts   # Build candidate objects (includes combo capacity calculation)
│   │   ├── wokibrain.ts      # Deterministic selection strategy
│   │   └── time.ts           # Time utilities (grid alignment, timezone)
│   └── interfaces/           # Ports (repository, lock, idempotency, logging)
│
├── application/              # Use cases (orchestrators)
│   └── use_cases/
│       ├── discover_seats.ts # Discover available seating options
│       ├── create_booking.ts # Create booking with locking & idempotency
│       └── list_bookings.ts  # List bookings for a day
│
├── infrastructure/           # Adapters (implementations)
│   ├── store/
│   │   ├── repositories/     # In-memory repository implementations
│   │   ├── locks/            # In-memory lock manager
│   │   ├── idempotency/      # In-memory idempotency store
│   │   └── seed/             # Seed data loader
│   └── logging/              # Pino logging adapter
│
├── presentation/             # API layer
│   ├── api/
│   │   ├── routers/          # Express routers
│   │   ├── schemas/          # Zod validation schemas
│   │   └── swagger/          # Swagger/OpenAPI configuration
│   └── middlewares/          # Request ID, error handling
│
└── tests/
    ├── unittest/             # Unit tests (domain services)
    └── integration/          # Integration tests (API endpoints)
```

### Dependency Flow

- **Domain** → No dependencies (pure TypeScript)
- **Application** → Depends on Domain interfaces
- **Infrastructure** → Implements Domain interfaces
- **Presentation** → Depends on Application use cases and Domain interfaces

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Unit tests
npm test -- tests/unittest/

# Integration tests
npm test -- tests/integration/
```

### Test Coverage

The project includes comprehensive test coverage:

- **Unit Tests**: Domain services (gap discovery, combo intersection, WokiBrain selection)
- **Integration Tests**: API endpoints with all required test cases:
  - ✅ Happy single: Perfect gap on a single table
  - ✅ Happy combo: Valid combination when singles cannot fit
  - ✅ Boundary: Bookings touching at end (end-exclusive)
  - ✅ Idempotency: Repeat POST with same Idempotency-Key
  - ✅ Concurrency: Two parallel creates → one 201, one 409
  - ✅ Outside hours: Request window outside service windows → 422

---

## Logging

The application uses **Pino** for structured JSON logging. Logs include:

- `requestId`: Unique request identifier
- `sectorId`: Sector ID
- `partySize`: Number of people
- `duration`: Duration in minutes
- `op`: Operation name (`discover`, `create_booking`, `list_bookings`)
- `durationMs`: Operation duration in milliseconds
- `outcome`: Result (`success`, `error`, `not_found`, `no_capacity`, etc.)

**Development mode:** Pretty-printed logs  
**Production mode:** JSON logs

---

## License

This project is part of the WokiBrain challenge.
