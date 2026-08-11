const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function checkedMinor(value: bigint, fieldName: string): string {
  if (value < 0n || value > MAX_SAFE_MINOR) {
    throw new Error(`${fieldName} minor units overflow`);
  }
  return value.toString();
}

export function normalizeSafeMinor(
  value: string | number | null | undefined,
  fieldName = 'amount',
): string {
  if (value == null || value === '') return '0';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${fieldName} minor units: ${String(value)}`);
    }
    return String(value);
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${fieldName} minor units: ${value}`);
  }
  return checkedMinor(BigInt(value), fieldName);
}

export function normalizePositiveSafeMinor(
  value: string | number | null | undefined,
  fieldName = 'amount',
): string {
  const normalized = normalizeSafeMinor(value, fieldName);
  if (normalized === '0') {
    throw new Error(`${fieldName} must be positive`);
  }
  return normalized;
}

export function addSafeMinor(
  left: string | number,
  right: string | number,
  fieldName = 'total',
): string {
  const sum =
    BigInt(normalizeSafeMinor(left, fieldName)) +
    BigInt(normalizeSafeMinor(right, fieldName));
  return checkedMinor(sum, fieldName);
}

export function subtractSafeMinor(
  total: string | number,
  part: string | number,
  fieldName = 'amount',
): string {
  const difference =
    BigInt(normalizeSafeMinor(total, fieldName)) -
    BigInt(normalizeSafeMinor(part, fieldName));
  return checkedMinor(difference, fieldName);
}

/** Convert a persisted decimal-peso value to exact integer centavos. */
export function decimalPesosToMinor(
  value: string | number | null | undefined,
  fieldName = 'amount',
): string {
  if (value == null || value === '') return '0';
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`Invalid ${fieldName}: ${String(value)}`);
  }
  const raw = String(value);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error(`Invalid ${fieldName}: ${raw}`);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return checkedMinor(
    BigInt(match[1]) * 100n + BigInt(fraction || '0'),
    fieldName,
  );
}

export function minorToCredits(value: string | number): number {
  const normalized = normalizePositiveSafeMinor(value, 'quotedTotalMinor');
  return Number(normalized) / 100;
}
