import { describe, expect, it } from 'vitest';
import type { ServiceCategory } from '@/types/products';
import { buildCategoryPayload, catalogAdminCategories, groupCatalogCategories } from './catalog-groups';

const category = (group: number, leaf: number): ServiceCategory => ({
  id: `${group}-${leaf}`,
  slug: `leaf-${group}-${leaf}`,
  name: `Leaf ${group}-${leaf}`,
  group_slug: `group-${group}`,
  group_name: `Group ${group}`,
  group_description: `Description ${group}`,
  group_sort_order: group,
  examples: [],
  description: '',
  file_processing_type: 'generic_file',
  pricing_model: 'quote_required',
  base_rate: 0,
  quantity_unit: 'piece',
  max_file_size_mb: 100,
  allowed_extensions: ['pdf'],
  is_active: true,
  sort_order: leaf,
  created_at: '',
  updated_at: '',
});

describe('groupCatalogCategories', () => {
  it('groups seventeen leaves into four server-owned ordered sections', () => {
    const sizes = [5, 4, 4, 4];
    const input = sizes.flatMap((size, groupIndex) =>
      Array.from({ length: size }, (_, leafIndex) => category(groupIndex + 1, leafIndex + 1)),
    ).reverse();
    const groups = groupCatalogCategories(input);
    expect(groups.map((group) => [group.slug, group.products.length])).toEqual([
      ['group-1', 5], ['group-2', 4], ['group-3', 4], ['group-4', 4],
    ]);
    expect(groups.flatMap((group) => group.products)).toHaveLength(17);
  });

  it('keeps unknown ungrouped leaves visible instead of coercing them', () => {
    const future = { ...category(1, 1), slug: 'future-leaf', group_slug: undefined, group_name: undefined };
    expect(groupCatalogCategories([future])[0]).toMatchObject({
      slug: 'ungrouped',
      products: [{ slug: 'future-leaf' }],
    });
  });

  it('sends group, RFQ, ordering, activation, and upload policy fields', () => {
    expect(buildCategoryPayload({
      name: 'Future Leaf', slug: 'future-leaf', group_slug: 'future-group',
      group_name: 'Future Group', group_description: 'Future products',
      group_sort_order: 8, examples: 'One, Two', description: 'Leaf',
      mobile_description: 'Leaf mobile', file_processing_type: 'generic_file',
      pricing_model: 'quote_required', base_rate: 0, quantity_unit: 'piece',
      max_file_size_mb: 200, allowed_extensions: 'PDF, ai', is_active: false,
      sort_order: 9,
    })).toEqual({
      name: 'Future Leaf', slug: 'future-leaf', groupSlug: 'future-group',
      groupName: 'Future Group', groupDescription: 'Future products',
      groupSortOrder: 8, examples: ['One', 'Two'], description: 'Leaf',
      mobileDescription: 'Leaf mobile', fileProcessingType: 'generic_file',
      pricingModel: 'quote_required', baseRate: 0, quantityUnit: 'piece',
      maxFileSizeMb: 200, allowedExtensions: '["pdf","ai"]', isActive: false,
      sortOrder: 9,
    });
  });

  it('excludes only exact inactive legacy leaves from the four RFQ sections', () => {
    const paper = { ...category(1, 1), slug: 'paper', group_slug: undefined, group_name: undefined, is_active: false };
    const threeD = { ...paper, id: 'legacy-3d', slug: '3d' };
    const future = { ...paper, id: 'future', slug: 'future-leaf' };
    expect(catalogAdminCategories([paper, threeD, future]).map((item) => item.slug)).toEqual(['future-leaf']);
  });
});
