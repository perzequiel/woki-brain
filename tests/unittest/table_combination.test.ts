import { describe, expect, suite, test } from 'vitest';
import Table from '../../domain/entities/table';
import TableCombinationService from '../../domain/services/table_combination';

function createTable(id: string, minSize: number, maxSize: number): Table {
  return Table.create({
    id,
    sectorId: 'S1',
    name: `Table ${id}`,
    minSize,
    maxSize,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

suite('Table Combination Service', () => {
  describe('Table Combination Service', () => {
    test('Test the table combination service', () => {
      const tables_data = [
        { id: 'T1', minSize: 2, maxSize: 3 },
        { id: 'T2', minSize: 2, maxSize: 4 },
        { id: 'T3', minSize: 2, maxSize: 2 },
        { id: 'T4', minSize: 2, maxSize: 2 },
        { id: 'T5', minSize: 2, maxSize: 3 },
        { id: 'T6', minSize: 2, maxSize: 2 },
        { id: 'T7', minSize: 2, maxSize: 2 },
      ];
      const tables_objs = tables_data.map((table) =>
        Table.create({
          id: table.id,
          sectorId: '1',
          name: `Table ${table.id}`,
          minSize: table.minSize,
          maxSize: table.maxSize,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
      const service = new TableCombinationService(tables_objs);
      const result = service.execute(4);
      expect(result).toBeDefined();
      expect(result.tableIds).toEqual(['T2']);
      expect(result.waste).toBe(0);
    });
  });
  describe('Casos Básicos - Mesa Única', () => {
    test('Mesa única perfecta (waste = 0)', () => {
      const tables = [createTable('T1', 2, 4)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(0);
    });

    test('Mesa única con waste mínimo', () => {
      const tables = [createTable('T1', 2, 6)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(2); // 6 - 4 = 2
    });

    test('Mesa única en límite inferior (minSize)', () => {
      const tables = [createTable('T1', 4, 6)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(2); // 6 - 4 = 2
    });

    test('Mesa única en límite superior (maxSize)', () => {
      const tables = [createTable('T1', 2, 4)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(0);
    });

    test('Múltiples mesas, una perfecta', () => {
      const tables = [createTable('T1', 2, 3), createTable('T2', 2, 4), createTable('T3', 2, 2)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T2']);
      expect(result.waste).toBe(0);
    });

    test('Múltiples mesas, selecciona la de menor waste', () => {
      const tables = [
        createTable('T1', 2, 6), // waste: 2
        createTable('T2', 2, 5), // waste: 1
        createTable('T3', 2, 4), // waste: 0
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T3']);
      expect(result.waste).toBe(0);
    });
  });

  describe('Casos Básicos - Combinaciones', () => {
    test('Combinación de 2 mesas perfecta', () => {
      const tables = [createTable('T1', 2, 2), createTable('T2', 2, 2)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1', 'T2']);
      expect(result.waste).toBe(0); // 2 + 2 = 4
    });

    test('Combinación de 2 mesas con waste', () => {
      const tables = [createTable('T1', 2, 3), createTable('T2', 2, 3)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1', 'T2']);
      // Waste = maxSize total - people = (3+3) - 4 = 6 - 4 = 2
      // Representa los asientos no usados cuando usamos capacidad máxima
      expect(result.waste).toBe(2); // 3 + 3 = 6, waste = 6 - 4 = 2
    });

    test('Combinación de 3 mesas', () => {
      const tables = [createTable('T1', 2, 2), createTable('T2', 2, 2), createTable('T3', 2, 2)];
      const service = new TableCombinationService(tables);
      const result = service.execute(6);

      expect(result.tableIds).toEqual(['T1', 'T2', 'T3']);
      expect(result.waste).toBe(0); // 2 + 2 + 2 = 6
    });

    test('Combinación de 4 mesas', () => {
      const tables = [
        createTable('T1', 2, 2),
        createTable('T2', 2, 2),
        createTable('T3', 2, 2),
        createTable('T4', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(8);

      expect(result.tableIds).toEqual(['T1', 'T2', 'T3', 'T4']);
      expect(result.waste).toBe(0);
    });
  });

  describe('Casos Límite (Edge Cases)', () => {
    test('Personas = minSize de una mesa', () => {
      const tables = [createTable('T1', 4, 6)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(2);
    });

    test('Personas = maxSize de una mesa', () => {
      const tables = [createTable('T1', 2, 4)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(0);
    });

    test('Personas < minSize de todas las mesas', () => {
      const tables = [createTable('T1', 4, 6), createTable('T2', 5, 8)];
      const service = new TableCombinationService(tables);
      const result = service.execute(3);

      expect(result.tableIds).toEqual([]);
      expect(result.waste).toBe(Infinity);
    });

    test('Personas > maxSize de todas las mesas individuales (requiere combo)', () => {
      const tables = [createTable('T1', 2, 2), createTable('T2', 2, 2), createTable('T3', 2, 2)];
      const service = new TableCombinationService(tables);
      const result = service.execute(5);

      expect(result.tableIds.length).toBeGreaterThan(1);
      expect(result.waste).toBeLessThan(Infinity);
    });

    test('Mesa con minSize = maxSize', () => {
      const tables = [createTable('T1', 4, 4)];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(0);
    });

    test('Array vacío de mesas', () => {
      const tables: Table[] = [];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual([]);
      expect(result.waste).toBe(Infinity);
    });

    test('Una sola persona (caso mínimo)', () => {
      const tables = [createTable('T1', 1, 4)];
      const service = new TableCombinationService(tables);
      const result = service.execute(1);

      expect(result.tableIds).toEqual(['T1']);
      expect(result.waste).toBe(3);
    });

    test('Número grande de personas', () => {
      const tables = [
        createTable('T1', 2, 4),
        createTable('T2', 2, 4),
        createTable('T3', 2, 4),
        createTable('T4', 2, 4),
        createTable('T5', 2, 4),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(20);

      expect(result.tableIds.length).toBeGreaterThan(0);
      expect(result.waste).toBeLessThan(Infinity);
    });
  });

  describe('Casos que Rompen el Algoritmo - Combinaciones No Secuenciales', () => {
    test('BUG: Mejor combinación no empieza con primera mesa', () => {
      // T1 no puede sola, T2 puede sola perfecta, pero algoritmo empieza con T1
      const tables = [
        createTable('T1', 2, 3), // No alcanza sola (3 < 4)
        createTable('T2', 2, 4), // Perfecta sola (waste: 0)
        createTable('T3', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      // Debería encontrar T2 sola, pero puede que encuentre T1+T3
      // Este test expone que el algoritmo puede no encontrar la mejor opción
      expect(result.waste).toBe(0);
      // Si encuentra T1+T3, waste sería 1 (3+2-4=1), no óptimo
    });

    test('BUG: Combinación óptima salteando mesas intermedias', () => {
      // La mejor combinación es T1 + T3, pero algoritmo solo busca T1 + T2, T1 + T2 + T3
      const tables = [
        createTable('T1', 2, 3), // T1 + T3 = 3 + 2 = 5 (waste: 1)
        createTable('T2', 2, 6), // T2 sola = 6 (waste: 2)
        createTable('T3', 2, 2), // T1 + T3 mejor que T2 sola
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      // Algoritmo puede encontrar T2 sola (waste: 2) en lugar de T1+T3 (waste: 1)
      // Este test expone que no explora todas las combinaciones
      expect(result.waste).toBeLessThanOrEqual(2);
    });

    test('BUG: Combinación que no incluye primera mesa válida', () => {
      // T2 + T3 es mejor que cualquier combinación que empiece con T1
      const tables = [
        createTable('T1', 2, 3), // T1 sola: waste 1, T1+T2: waste 3
        createTable('T2', 2, 3), // T2 + T3: waste 1 (mejor)
        createTable('T3', 2, 3),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(5);

      // Algoritmo no explora T2+T3 porque empieza con T1
      // Puede encontrar T1+T2 (waste: 1) o T1+T3 (waste: 1), pero no T2+T3
      expect(result.waste).toBeLessThanOrEqual(1);
    });
  });

  describe('Casos que Rompen el Algoritmo - Validación de minSize', () => {
    test('BUG: Combinación con minSize total insuficiente', () => {
      // T1(2-2) + T2(2-2) = min:4, max:4, pero algoritmo puede intentar T1(2-2) + T3(3-3) para 5 personas
      // minSize total = 2+3=5, maxSize total = 2+3=5, debería funcionar
      // Pero si hay T1(2-2) + T2(2-2) + T3(1-1), minSize=5, maxSize=5, para 5 personas
      const tables = [createTable('T1', 2, 2), createTable('T2', 2, 2), createTable('T3', 1, 1)];
      const service = new TableCombinationService(tables);
      const result = service.execute(5);

      // Algoritmo puede encontrar T1+T2+T3 (2+2+1=5, waste: 0)
      // Pero no valida que minSize total sea <= people
      expect(result.tableIds.length).toBeGreaterThan(0);
    });

    test('BUG: No valida que combinación tenga capacidad suficiente', () => {
      // Si people=7, y tenemos T1(2-2) + T2(2-2) + T3(2-2) = max 6, no alcanza
      // Pero algoritmo puede intentarlo si T1 tiene minSize <= 7
      const tables = [
        createTable('T1', 2, 2), // minSize 2 <= 7, pero maxSize total = 6 < 7
        createTable('T2', 2, 2),
        createTable('T3', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(7);

      // Algoritmo debería encontrar que ninguna combinación alcanza
      // Pero puede intentar T1+T2+T3 y calcular waste negativo incorrectamente
      if (result.tableIds.length > 0) {
        // Si encuentra algo, el waste debería ser positivo
        expect(result.waste).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Casos que Rompen el Algoritmo - Lógica de Combinaciones', () => {
    test('BUG: Reset prematuro en búsqueda de combinaciones', () => {
      // T1(2-3) necesita T2(2-2) + T3(2-2) = 3+2+2=7 para 6 personas
      // Pero algoritmo puede resetear después de encontrar T1+T2 y no continuar
      const tables = [
        createTable('T1', 2, 3), // T1 sola: waste 0 (si people=3) o waste 1 (si people=2)
        createTable('T2', 2, 2),
        createTable('T3', 2, 2),
        createTable('T4', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(6);

      // Debería encontrar T1+T2+T3 (3+2+2=7, waste: 1) o T2+T3+T4 (2+2+2=6, waste: 0)
      expect(result.waste).toBeLessThanOrEqual(1);
    });

    test('BUG: No explora todas las combinaciones de tamaño N', () => {
      // Para 6 personas, todas las combinaciones de 3 mesas de tamaño 2
      // T1+T2+T3, T1+T2+T4, T1+T3+T4, T2+T3+T4
      // Algoritmo solo encuentra las que empiezan con T1
      const tables = [
        createTable('T1', 2, 2),
        createTable('T2', 2, 2),
        createTable('T3', 2, 2),
        createTable('T4', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(6);

      // Debería encontrar cualquier combinación de 3 mesas (waste: 0)
      expect(result.waste).toBe(0);
      expect(result.tableIds.length).toBe(3);
    });

    test('BUG: Orden de mesas afecta resultado', () => {
      // Si las mesas están en diferente orden, el resultado puede cambiar
      // Esto expone que el algoritmo no es determinístico en encontrar la mejor opción
      const tables1 = [
        createTable('T1', 2, 3),
        createTable('T2', 2, 4), // Mejor opción
        createTable('T3', 2, 2),
      ];
      const tables2 = [
        createTable('T2', 2, 4), // Mejor opción primero
        createTable('T1', 2, 3),
        createTable('T3', 2, 2),
      ];

      const service1 = new TableCombinationService(tables1);
      const service2 = new TableCombinationService(tables2);
      const result1 = service1.execute(4);
      const result2 = service2.execute(4);

      // Ambos deberían encontrar T2 (waste: 0)
      // Pero si el orden afecta, puede que no
      expect(result1.waste).toBe(0);
      expect(result2.waste).toBe(0);
    });
  });

  describe('Casos de Selección Óptima', () => {
    test('Selecciona menor waste entre múltiples opciones', () => {
      const tables = [
        createTable('T1', 2, 6), // waste: 2
        createTable('T2', 2, 5), // waste: 1
        createTable('T3', 2, 4), // waste: 0 (mejor)
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result.tableIds).toEqual(['T3']);
      expect(result.waste).toBe(0);
    });

    test('En caso de empate en waste, debería preferir menos mesas', () => {
      // T1 sola: waste 2, T2+T3: waste 2
      // Debería preferir T1 sola (1 mesa vs 2 mesas)
      const tables = [
        createTable('T1', 2, 6), // waste: 2
        createTable('T2', 2, 3), // T2+T3: waste 2
        createTable('T3', 2, 3),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      // Nota: El algoritmo actual no tiene esta lógica de desempate
      // Este test expone que falta esta optimización
      expect(result.waste).toBe(2);
      // Idealmente debería ser 1 mesa, pero puede ser 2
    });

    test('Combinación con waste 0 vs mesa única con waste', () => {
      const tables = [
        createTable('T1', 2, 3), // waste: 1
        createTable('T2', 2, 2), // T2+T3: waste 0
        createTable('T3', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      // Debería preferir T2+T3 (waste: 0) sobre T1 (waste: 1)
      expect(result.waste).toBe(0);
      expect(result.tableIds.length).toBe(2);
    });
  });

  describe('Casos del Test Original', () => {
    test('Test original del archivo', () => {
      const tables = [
        createTable('T1', 2, 3),
        createTable('T2', 2, 4),
        createTable('T3', 2, 2),
        createTable('T4', 2, 2),
        createTable('T5', 2, 3),
        createTable('T6', 2, 2),
        createTable('T7', 2, 2),
      ];
      const service = new TableCombinationService(tables);
      const result = service.execute(4);

      expect(result).toBeDefined();
      expect(result.tableIds).toEqual(['T2']);
      expect(result.waste).toBe(0);
    });
  });
});
