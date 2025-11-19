# WokiBrain - Booking Engine

A compact booking engine for restaurants that discovers **when** and **how** to seat a party using single tables or table combinations.

## Features

- ✅ Gap discovery for time-based availability
- ✅ Table combination selection by capacity
- ✅ Deterministic selection strategy
- ✅ Concurrency handling (no double booking)
- ✅ Idempotency support

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

The heuristic is implemented in `domain/services/table_combination.ts`:

```typescript
// Calculate total capacity of a combination
const totalMinSize = tables.reduce((sum, table) => sum + table.minSize, 0);
const totalMaxSize = tables.reduce((sum, table) => sum + table.maxSize, 0);
```

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
  - `gap_discovery.ts` - Table combination selection by capacity
  - `time.ts` - Time utilities

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

- Node.js 18+
- TypeScript 5.0+

### Installation

```bash
npm install
```

### Running Tests

```bash
npm test
```

---

## License

This project is part of the WokiBrain challenge.
