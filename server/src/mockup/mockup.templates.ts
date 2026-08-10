/**
 * Static Product Preview templates (non-production).
 * Full raster composites deferred — versioned descriptors still enable
 * invalidation + client labeling.
 */

export type MockupTemplateDef = {
  productType: string;
  templateVersion: string;
  /** Human label for UI */
  label: string;
  /** Background / product silhouette hint for client layout */
  surfaceColor: string;
  accentColor: string;
  aspectRatio: string;
  /** Static composite path under API public mockups */
  staticPath: string;
};

export const MOCKUP_TEMPLATE_CATALOG: Record<string, MockupTemplateDef> = {
  flyer: {
    productType: 'flyer',
    templateVersion: 'flyer-v1',
    label: 'Flyer A4 mockup',
    surfaceColor: '#F5F5F0',
    accentColor: '#FFDE58',
    aspectRatio: '210:297',
    staticPath: '/api/mockups/static/flyer-v1.svg',
  },
  tarpaulin: {
    productType: 'tarpaulin',
    templateVersion: 'tarpaulin-v1',
    label: 'Tarpaulin mockup',
    surfaceColor: '#E8EEF5',
    accentColor: '#2B6CB0',
    aspectRatio: '16:9',
    staticPath: '/api/mockups/static/tarpaulin-v1.svg',
  },
  signage: {
    productType: 'signage',
    templateVersion: 'signage-v1',
    label: 'Signage mockup',
    surfaceColor: '#FFF8E7',
    accentColor: '#C05621',
    aspectRatio: '4:3',
    staticPath: '/api/mockups/static/signage-v1.svg',
  },
  't-shirt': {
    productType: 't-shirt',
    templateVersion: 'tshirt-v1',
    label: 'T-shirt mockup',
    surfaceColor: '#EDF2F7',
    accentColor: '#2D3748',
    aspectRatio: '1:1',
    staticPath: '/api/mockups/static/tshirt-v1.svg',
  },
  other: {
    productType: 'other',
    templateVersion: 'generic-v1',
    label: 'Generic product mockup',
    surfaceColor: '#F7FAFC',
    accentColor: '#4A5568',
    aspectRatio: '1:1',
    staticPath: '/api/mockups/static/generic-v1.svg',
  },
};

/** Map free-form category / catalog slugs to a mockup product type. */
export function resolveMockupProductType(
  productType?: string | null,
  categoryHint?: string | null,
): string {
  const raw = (productType || categoryHint || 'other').toLowerCase().trim();
  if (raw in MOCKUP_TEMPLATE_CATALOG) return raw;
  if (raw.includes('flyer') || raw.includes('brochure') || raw === 'paper') {
    return 'flyer';
  }
  if (raw.includes('tarp') || raw.includes('banner')) return 'tarpaulin';
  if (raw.includes('sign') || raw.includes('poster') || raw.includes('board')) {
    return 'signage';
  }
  if (
    raw.includes('shirt') ||
    raw.includes('apparel') ||
    raw.includes('textile')
  ) {
    return 't-shirt';
  }
  return 'other';
}

export function getMockupTemplate(productType: string): MockupTemplateDef {
  return MOCKUP_TEMPLATE_CATALOG[productType] ?? MOCKUP_TEMPLATE_CATALOG.other;
}

/** Inline SVG composite — labeled non-production for client/webview display. */
export function buildStaticMockupSvg(def: MockupTemplateDef): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${def.surfaceColor}"/>
  <rect x="80" y="60" width="640" height="400" rx="12" fill="#ffffff" stroke="${def.accentColor}" stroke-width="4"/>
  <text x="400" y="240" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#2D3748">${escapeXml(def.label)}</text>
  <text x="400" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#718096">Template ${escapeXml(def.templateVersion)}</text>
  <rect x="200" y="480" width="400" height="48" rx="8" fill="${def.accentColor}"/>
  <text x="400" y="512" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#1A202C">MOCKUP — NOT PRINT-READY</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
