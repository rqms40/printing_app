export type OpenRouteSolution = {
  indices: number[];
  totalDurationSeconds: number;
};

type Candidate = OpenRouteSolution;

function routeKeys(indices: number[], assignmentIds: number[]): number[] {
  return indices.slice(1).map((index) => assignmentIds[index]);
}

function isPreferred(
  candidate: Candidate,
  current: Candidate | undefined,
  assignmentIds: number[],
): boolean {
  if (!current) return true;
  if (candidate.totalDurationSeconds !== current.totalDurationSeconds) {
    return candidate.totalDurationSeconds < current.totalDurationSeconds;
  }
  const candidateKeys = routeKeys(candidate.indices, assignmentIds);
  const currentKeys = routeKeys(current.indices, assignmentIds);
  for (let index = 0; index < candidateKeys.length; index += 1) {
    if (candidateKeys[index] !== currentKeys[index]) {
      return candidateKeys[index] < currentKeys[index];
    }
  }
  return false;
}

export function solveOpenRoute(
  durationsSeconds: Array<Array<number | null>>,
  assignmentIds: number[] = durationsSeconds.map((_row, index) => index),
): OpenRouteSolution {
  const pointCount = durationsSeconds.length;
  if (
    pointCount < 2 ||
    pointCount > 6 ||
    assignmentIds.length !== pointCount ||
    durationsSeconds.some(
      (row) =>
        row.length !== pointCount ||
        row.some(
          (cell) => cell == null || !Number.isFinite(cell) || Number(cell) < 0,
        ),
    )
  ) {
    throw new Error(
      'A complete square matrix for one to five stops is required',
    );
  }

  const stopCount = pointCount - 1;
  const states = new Map<string, Candidate>();
  for (let stop = 1; stop < pointCount; stop += 1) {
    states.set(`${1 << (stop - 1)}:${stop}`, {
      indices: [0, stop],
      totalDurationSeconds: Number(durationsSeconds[0][stop]),
    });
  }

  for (let mask = 1; mask < 1 << stopCount; mask += 1) {
    for (let last = 1; last < pointCount; last += 1) {
      const current = states.get(`${mask}:${last}`);
      if (!current) continue;
      for (let next = 1; next < pointCount; next += 1) {
        const bit = 1 << (next - 1);
        if ((mask & bit) !== 0) continue;
        const nextMask = mask | bit;
        const candidate: Candidate = {
          indices: [...current.indices, next],
          totalDurationSeconds:
            current.totalDurationSeconds + Number(durationsSeconds[last][next]),
        };
        const key = `${nextMask}:${next}`;
        if (isPreferred(candidate, states.get(key), assignmentIds)) {
          states.set(key, candidate);
        }
      }
    }
  }

  const completeMask = (1 << stopCount) - 1;
  let best: Candidate | undefined;
  for (let last = 1; last < pointCount; last += 1) {
    const candidate = states.get(`${completeMask}:${last}`);
    if (candidate && isPreferred(candidate, best, assignmentIds)) {
      best = candidate;
    }
  }
  if (!best) throw new Error('No route visits every stop');
  return best;
}
