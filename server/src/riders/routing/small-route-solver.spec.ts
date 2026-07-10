import { solveOpenRoute } from './small-route-solver';

describe('solveOpenRoute', () => {
  it('chooses Ven before farther Mark by road duration', () => {
    const result = solveOpenRoute([
      [0, 900, 240],
      [900, 0, 500],
      [240, 500, 0],
    ]);
    expect(result.indices).toEqual([0, 2, 1]);
    expect(result.totalDurationSeconds).toBe(740);
  });

  it('breaks equal total cost lexicographically by assignment id', () => {
    const equalMatrix = [
      [0, 10, 10],
      [10, 0, 10],
      [10, 10, 0],
    ];
    expect(solveOpenRoute(equalMatrix, [0, 42, 17]).indices).toEqual([0, 2, 1]);
  });

  it.each([
    [
      'null cells',
      [
        [0, null],
        [10, 0],
      ],
    ],
    ['non-square matrices', [[0, 1], [1]]],
    ['more than five stops', Array.from({ length: 7 }, () => Array(7).fill(1))],
  ])('rejects %s', (_label, matrix) => {
    expect(() => solveOpenRoute(matrix)).toThrow();
  });
});
