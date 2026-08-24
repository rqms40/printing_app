import type { SupplierCatalogOffering } from './entities/supplier-catalog-offering.entity';

export type SelectedCatalogSpec = { key: string; value: string };

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function offeringCoversCategory(
  offering: Pick<SupplierCatalogOffering, 'categorySlugs' | 'isActive'>,
  categorySlug: string,
): boolean {
  if (offering.isActive === false) return false;
  const target = norm(categorySlug);
  return (offering.categorySlugs ?? []).some((slug) => norm(slug) === target);
}

export function catalogOfferingMatchesOrder(
  offering: Pick<SupplierCatalogOffering, 'specOptions' | 'addons'>,
  selectedSpecs: SelectedCatalogSpec[],
  addonNames: string[] = [],
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const specOptions = offering.specOptions ?? {};
  for (const spec of selectedSpecs) {
    const allowed = specOptions[spec.key];
    if (!Array.isArray(allowed) || allowed.length === 0) continue;
    const ok = allowed.some((value) => norm(value) === norm(spec.value));
    if (!ok) missing.push(`${spec.key}:${spec.value}`);
  }
  const offeredAddons = offering.addons ?? [];
  if (offeredAddons.length > 0) {
    for (const name of addonNames) {
      const ok = offeredAddons.some((addon) => norm(addon.name) === norm(name));
      if (!ok) missing.push(`addon:${name}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

export function evaluateSupplierCatalogFit(
  offerings: Array<
    Pick<
      SupplierCatalogOffering,
      'categorySlugs' | 'specOptions' | 'addons' | 'isActive'
    >
  >,
  categorySlug: string,
  selectedSpecs: SelectedCatalogSpec[],
  addonNames: string[] = [],
): { catalogMatch: boolean | null; missing: string[] } {
  const covering = offerings.filter((o) =>
    offeringCoversCategory(o, categorySlug),
  );
  if (covering.length === 0) {
    return { catalogMatch: null, missing: [] };
  }
  const missing = new Set<string>();
  let anyOk = false;
  for (const offering of covering) {
    const result = catalogOfferingMatchesOrder(
      offering,
      selectedSpecs,
      addonNames,
    );
    if (result.ok) anyOk = true;
    else result.missing.forEach((item) => missing.add(item));
  }
  return {
    catalogMatch: anyOk,
    missing: anyOk ? [] : [...missing],
  };
}
