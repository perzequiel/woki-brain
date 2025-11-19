import Booking from '../entities/booking';
import Table from '../entities/table';
import GapDiscoveryService, { TimeGap } from './gap_discovery';

/**
 * Finds gaps for multiple tables and intersects them to find combo gaps.
 * A combo gap is a period where ALL tables in the combination are simultaneously free.
 *
 * @param tables - Array of tables in the combination
 * @param bookings - All bookings for the day
 * @param date - Date string (YYYY-MM-DD)
 * @param durationMinutes - Required duration (multiple of 15)
 * @param serviceWindows - Optional service windows
 * @param timezone - IANA timezone
 * @returns Array of combo gaps where all tables are free simultaneously
 */
export function findComboGaps(
  tables: Table[],
  bookings: Booking[],
  date: string,
  durationMinutes: number,
  serviceWindows?: Array<{ start: string; end: string }>,
  timezone: string = 'America/Argentina/Buenos_Aires'
): TimeGap[] {
  const gapService = new GapDiscoveryService();

  // Step 1: Find gaps for each table individually
  const gapsPerTable = tables.map((table) =>
    gapService.findGapsForTable({
      table,
      bookings,
      date,
      durationMinutes,
      serviceWindows,
      timezone,
    })
  );

  // Step 2: If any table has no gaps, combo has no gaps
  if (gapsPerTable.some((gaps) => gaps.length === 0)) {
    return [];
  }

  // Step 3: Intersect gaps - find periods where all tables are free
  return intersectGaps(gapsPerTable, durationMinutes);
}

/**
 * Intersects multiple gap arrays to find periods where all gaps overlap.
 *
 * Algorithm:
 * 1. Start with gaps from first table
 * 2. For each subsequent table, find intersections with current result
 * 3. Keep only gaps that overlap across all tables
 *
 * @param gapsPerTable - Array of gap arrays, one per table
 * @param minDurationMinutes - Minimum duration required
 * @returns Intersected gaps where all tables are free simultaneously
 */
function intersectGaps(gapsPerTable: TimeGap[][], minDurationMinutes: number): TimeGap[] {
  if (gapsPerTable.length === 0) {
    return [];
  }

  if (gapsPerTable.length === 1) {
    return gapsPerTable[0];
  }

  // Start with gaps from first table
  let result: TimeGap[] = gapsPerTable[0];

  // Intersect with each subsequent table
  for (let i = 1; i < gapsPerTable.length; i++) {
    const currentTableGaps = gapsPerTable[i];
    result = intersectTwoGapSets(result, currentTableGaps);
  }

  // Filter by minimum duration
  return result.filter((gap) => gap.durationMinutes >= minDurationMinutes);
}

/**
 * Intersects two gap arrays to find overlapping periods.
 *
 * @param gaps1 - First gap array
 * @param gaps2 - Second gap array
 * @returns Gaps that overlap between both arrays
 */
function intersectTwoGapSets(gaps1: TimeGap[], gaps2: TimeGap[]): TimeGap[] {
  const intersections: TimeGap[] = [];

  for (const gap1 of gaps1) {
    for (const gap2 of gaps2) {
      // Find overlap: [max(start1, start2), min(end1, end2))
      const overlapStart = gap1.start > gap2.start ? gap1.start : gap2.start;
      const overlapEnd = gap1.end < gap2.end ? gap1.end : gap2.end;

      // If there's a valid overlap (start < end)
      if (overlapStart < overlapEnd) {
        const durationMinutes = Math.floor(
          (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
        );

        intersections.push({
          start: overlapStart,
          end: overlapEnd,
          durationMinutes,
        });
      }
    }
  }

  // Sort by start time and merge adjacent/overlapping intersections
  return mergeOverlappingGaps(intersections);
}

/**
 * Merges overlapping or adjacent gaps.
 *
 * @param gaps - Array of gaps (may overlap)
 * @returns Merged gaps without overlaps
 */
function mergeOverlappingGaps(gaps: TimeGap[]): TimeGap[] {
  if (gaps.length === 0) {
    return [];
  }

  // Sort by start time
  const sorted = [...gaps].sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeGap[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // If current and next overlap or are adjacent (end exclusive, so equal is OK)
    if (current.end >= next.start) {
      // Merge: extend current to max of both ends
      current = {
        start: current.start,
        end: current.end > next.end ? current.end : next.end,
        durationMinutes: Math.floor(
          ((current.end > next.end ? current.end : next.end).getTime() - current.start.getTime()) /
            (1000 * 60)
        ),
      };
    } else {
      // No overlap, add current and move to next
      merged.push(current);
      current = next;
    }
  }

  // Add the last gap
  merged.push(current);

  return merged;
}
