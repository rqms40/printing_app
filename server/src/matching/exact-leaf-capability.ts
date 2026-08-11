export type LeafCapability = {
  productFamily: string;
  isActive: boolean;
};

function normalizeLeaf(value: string): string {
  return value.trim().toLowerCase();
}

export function findExactActiveLeafCapability<T extends LeafCapability>(
  capabilities: readonly T[] | undefined,
  requestedLeaf: string,
): T | null {
  const target = normalizeLeaf(requestedLeaf);
  if (!target) return null;
  return (
    capabilities?.find(
      (capability) =>
        capability.isActive === true &&
        normalizeLeaf(capability.productFamily) === target,
    ) ?? null
  );
}

export function hasExactActiveLeafCapability(
  capabilities: readonly LeafCapability[] | undefined,
  requestedLeaf: string,
): boolean {
  return findExactActiveLeafCapability(capabilities, requestedLeaf) != null;
}
