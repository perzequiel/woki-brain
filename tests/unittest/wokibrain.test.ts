import { describe, expect, test } from 'vitest';
import Table from '../../domain/entities/table';
import CandidateBuilder from '../../domain/services/candidate_builder';
import { TimeGap } from '../../domain/services/gap_discovery';
import WokiBrainService, { Candidate } from '../../domain/services/wokibrain';

function createTable(id: string, minSize: number, maxSize: number): Table {
  return Table.create({
    id,
    sectorId: 'S1',
    name: `Table ${id}`,
    minSize,
    maxSize,
    createdAt: '2025-10-22T00:00:00-03:00',
    updatedAt: '2025-10-22T00:00:00-03:00',
  });
}

function createTimeGap(startHour: number, startMin: number, durationMinutes: number): TimeGap {
  const start = new Date(
    `2025-10-22T${startHour.toString().padStart(2, '0')}:${startMin
      .toString()
      .padStart(2, '0')}:00-03:00`
  );
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    start,
    end,
    durationMinutes,
  };
}

describe('WokiBrain Selection Service', () => {
  const service = new WokiBrainService();

  describe('Selection Strategy', () => {
    test('Prefers single table over combo', () => {
      const singleCandidate: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90),
        3
      );

      const comboCandidate: Candidate = CandidateBuilder.createComboCandidate(
        [createTable('T2', 2, 2), createTable('T3', 2, 2)],
        createTimeGap(20, 0, 90),
        3
      );

      const result = service.selectBest({
        candidates: [comboCandidate, singleCandidate],
        partySize: 3,
      });

      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
      expect(result.candidate!.kind).toBe('single');
      expect(result.candidate!.tableIds).toEqual(['T1']);
    });

    test('Prefers combo with fewer tables', () => {
      const combo2Tables: Candidate = CandidateBuilder.createComboCandidate(
        [createTable('T1', 2, 2), createTable('T2', 2, 2)],
        createTimeGap(20, 0, 90),
        4
      );

      const combo3Tables: Candidate = CandidateBuilder.createComboCandidate(
        [createTable('T3', 2, 2), createTable('T4', 2, 2), createTable('T5', 2, 2)],
        createTimeGap(20, 0, 90),
        4
      );

      const result = service.selectBest({
        candidates: [combo3Tables, combo2Tables],
        partySize: 4,
      });

      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
      expect(result.candidate!.tableIds.length).toBe(2);
    });

    test('Minimizes waste when table count is equal', () => {
      const lowWaste: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4), // waste: 1 (4 - 3)
        createTimeGap(20, 0, 90),
        3
      );

      const highWaste: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T2', 2, 6), // waste: 3 (6 - 3)
        createTimeGap(20, 0, 90),
        3
      );

      const result = service.selectBest({
        candidates: [highWaste, lowWaste],
        partySize: 3,
      });

      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
      expect(result.candidate!.tableIds).toEqual(['T1']);
      expect(result.candidate!.waste).toBe(1);
    });

    test('Uses earliest gap as tie-breaker', () => {
      const earlyGap: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90), // 20:00
        3
      );

      const lateGap: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T2', 2, 4),
        createTimeGap(21, 0, 90), // 21:00
        3
      );

      const result = service.selectBest({
        candidates: [lateGap, earlyGap],
        partySize: 3,
      });

      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
      // Use timestamp comparison to avoid timezone issues
      const expectedStart = new Date('2025-10-22T20:00:00-03:00');
      const timeDiff = Math.abs(result.candidate!.gap.start.getTime() - expectedStart.getTime());
      expect(timeDiff).toBeLessThan(15 * 60 * 1000); // Within 15 minutes (grid alignment)
    });

    test('Returns null when no valid candidates', () => {
      const candidate: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 4, 6), // minSize: 4, maxSize: 6
        createTimeGap(20, 0, 90),
        3 // partySize: 3 < minSize: 4
      );

      const result = service.selectBest({
        candidates: [candidate],
        partySize: 3,
      });

      expect(result.hasCapacity).toBe(false);
      expect(result.candidate).toBeNull();
    });

    test('Returns null when no candidates provided', () => {
      const result = service.selectBest({
        candidates: [],
        partySize: 3,
      });

      expect(result.hasCapacity).toBe(false);
      expect(result.candidate).toBeNull();
    });
  });

  describe('Candidate Creation', () => {
    test('Creates single candidate correctly', () => {
      const table = createTable('T1', 2, 4);
      const gap = createTimeGap(20, 0, 90);

      const candidate = CandidateBuilder.createSingleCandidate(table, gap, 3);

      expect(candidate.kind).toBe('single');
      expect(candidate.tableIds).toEqual(['T1']);
      expect(candidate.capacity).toEqual({ minSize: 2, maxSize: 4 });
      expect(candidate.waste).toBe(1); // 4 - 3 = 1
      expect(candidate.gap).toBe(gap);
    });

    test('Creates combo candidate correctly', () => {
      const tables = [createTable('T1', 2, 3), createTable('T2', 2, 3)];
      const gap = createTimeGap(20, 0, 90);

      const candidate = CandidateBuilder.createComboCandidate(tables, gap, 5);

      expect(candidate.kind).toBe('combo');
      expect(candidate.tableIds).toEqual(['T1', 'T2']);
      expect(candidate.capacity).toEqual({ minSize: 4, maxSize: 6 }); // 2+2, 3+3
      expect(candidate.waste).toBe(1); // 6 - 5 = 1
      expect(candidate.gap).toBe(gap);
    });
  });

  describe('Determinism', () => {
    test('Returns same result for same inputs', () => {
      const candidates: Candidate[] = [
        CandidateBuilder.createSingleCandidate(
          createTable('T1', 2, 4),
          createTimeGap(20, 0, 90),
          3
        ),
        CandidateBuilder.createSingleCandidate(
          createTable('T2', 2, 6),
          createTimeGap(21, 0, 90),
          3
        ),
        CandidateBuilder.createComboCandidate(
          [createTable('T3', 2, 2), createTable('T4', 2, 2)],
          createTimeGap(20, 0, 90),
          3
        ),
      ];

      const result1 = service.selectBest({ candidates, partySize: 3 });
      const result2 = service.selectBest({ candidates, partySize: 3 });
      const result3 = service.selectBest({ candidates, partySize: 3 });

      // All results should be identical
      expect(result1.candidate?.tableIds).toEqual(result2.candidate?.tableIds);
      expect(result2.candidate?.tableIds).toEqual(result3.candidate?.tableIds);
      expect(result1.candidate?.gap.start.getTime()).toBe(result2.candidate?.gap.start.getTime());
    });

    test('Order of candidates does not affect result', () => {
      const candidate1 = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90),
        3
      );
      const candidate2 = CandidateBuilder.createSingleCandidate(
        createTable('T2', 2, 6),
        createTimeGap(21, 0, 90),
        3
      );

      const result1 = service.selectBest({
        candidates: [candidate1, candidate2],
        partySize: 3,
      });
      const result2 = service.selectBest({
        candidates: [candidate2, candidate1],
        partySize: 3,
      });

      // Should return same candidate regardless of order
      expect(result1.candidate?.tableIds).toEqual(result2.candidate?.tableIds);
    });
  });

  describe('Edge Cases', () => {
    test('Handles candidate with exact capacity (waste = 0)', () => {
      const candidate: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90),
        4 // Exact capacity
      );

      expect(candidate.waste).toBe(0);
      const result = service.selectBest({ candidates: [candidate], partySize: 4 });
      expect(result.hasCapacity).toBe(true);
    });

    test('Handles candidate at minimum capacity', () => {
      const candidate: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90),
        2 // Minimum capacity
      );

      const result = service.selectBest({ candidates: [candidate], partySize: 2 });
      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
    });

    test('Handles candidate at maximum capacity', () => {
      const candidate: Candidate = CandidateBuilder.createSingleCandidate(
        createTable('T1', 2, 4),
        createTimeGap(20, 0, 90),
        4 // Maximum capacity
      );

      const result = service.selectBest({ candidates: [candidate], partySize: 4 });
      expect(result.hasCapacity).toBe(true);
      expect(result.candidate).toBeDefined();
    });
  });
});
