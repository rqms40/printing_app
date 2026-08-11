import type { ServiceCategory } from '@/types/products';

export interface CatalogCategoryGroup {
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
  products: ServiceCategory[];
}

type CategoryFormValues = Record<string, unknown>;

function commaList(value: unknown, lowercase = false): string[] {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return values.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => lowercase ? entry.toLowerCase() : entry);
}

export function buildCategoryPayload(values: CategoryFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    groupSlug: values.group_slug,
    groupName: values.group_name,
    groupDescription: values.group_description,
    groupSortOrder: values.group_sort_order,
    examples: commaList(values.examples),
    description: values.description,
    mobileDescription: values.mobile_description,
    fileProcessingType: values.file_processing_type,
    pricingModel: values.pricing_model,
    baseRate: values.base_rate,
    quantityUnit: values.quantity_unit,
    maxFileSizeMb: values.max_file_size_mb,
    allowedExtensions: JSON.stringify(commaList(values.allowed_extensions, true)),
    isActive: values.is_active,
    sortOrder: values.sort_order ?? 0,
  };
}

export function catalogAdminCategories(
  categories: readonly ServiceCategory[],
): ServiceCategory[] {
  return categories.filter((category) =>
    !(!category.is_active && !category.group_slug &&
      (category.slug === 'paper' || category.slug === '3d')),
  );
}

export function groupCatalogCategories(
  categories: readonly ServiceCategory[],
): CatalogCategoryGroup[] {
  const groups = new Map<string, CatalogCategoryGroup>();
  for (const category of categories) {
    const slug = category.group_slug?.trim() || 'ungrouped';
    const current = groups.get(slug) ?? {
      slug,
      name: category.group_name?.trim() || 'Ungrouped products',
      description: category.group_description,
      sortOrder: category.group_sort_order ?? Number.MAX_SAFE_INTEGER,
      products: [],
    };
    current.products.push(category);
    groups.set(slug, current);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      products: [...group.products].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
