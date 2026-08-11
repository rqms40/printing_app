export const CATALOG_VERSION = '1.10' as const;

const GENERAL_ARTWORK_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'tif',
  'tiff',
  'ai',
  'psd',
] as const;

const MODEL_3D_EXTENSIONS = ['stl', 'obj', '3mf'] as const;

const CAD_EXTENSIONS = ['pdf', 'dwg', 'dxf'] as const;

const requiredText = (
  key: string,
  label: string,
  sortOrder: number,
  placeholder: string,
) => ({
  key,
  label,
  helpText: null,
  inputType: 'text' as const,
  valueType: 'string' as const,
  isRequired: true,
  pricingRole: 'none' as const,
  placeholder,
  sortOrder,
  options: [] as const,
});

export const CATALOG_V1_10_SPEC_TEMPLATES = {
  printCollateral: [
    requiredText(
      'dimensions_or_standard_size',
      'Dimensions or standard size',
      10,
      'Enter dimensions or a standard size',
    ),
    requiredText(
      'stock_or_material',
      'Stock or material',
      20,
      'Describe the requested stock or material',
    ),
    requiredText('color', 'Color', 30, 'Describe the requested color'),
    {
      key: 'sides',
      label: 'Sides',
      helpText: 'Enter 1 for single-sided or 2 for double-sided printing.',
      inputType: 'number',
      valueType: 'number',
      isRequired: true,
      pricingRole: 'none',
      minValue: 1,
      maxValue: 2,
      stepValue: 1,
      sortOrder: 40,
      options: [],
    },
    requiredText('finish', 'Finish', 50, 'Describe the requested finish'),
  ],
  merchandise: [
    requiredText(
      'item_subtype',
      'Item subtype',
      10,
      'Describe the item subtype',
    ),
    requiredText(
      'variant_or_size',
      'Variant or size',
      20,
      'Enter the requested variant or size',
    ),
    requiredText('color', 'Color', 30, 'Describe the requested color'),
    requiredText(
      'branding_method',
      'Branding method',
      40,
      'Describe the requested branding method',
    ),
    requiredText(
      'artwork_placement',
      'Artwork placement',
      50,
      'Describe where the artwork should appear',
    ),
  ],
  awardsAndSignage: [
    requiredText(
      'dimensions',
      'Dimensions',
      10,
      'Enter the required dimensions',
    ),
    requiredText('material', 'Material', 20, 'Describe the requested material'),
    requiredText('finish', 'Finish', 30, 'Describe the requested finish'),
    requiredText(
      'personalization_text',
      'Personalization text',
      40,
      'Enter names, titles, dates, or other personalization',
    ),
    {
      ...requiredText(
        'mounting_or_lighting',
        'Mounting or lighting',
        50,
        'Describe mounting or lighting needs, if applicable',
      ),
      isRequired: false,
    },
  ],
  fabrication3d: [
    requiredText(
      'dimensions_or_scale',
      'Dimensions or scale',
      10,
      'Enter finished dimensions or scale',
    ),
    requiredText('material', 'Material', 20, 'Describe the requested material'),
    requiredText('color', 'Color', 30, 'Describe the requested color'),
    requiredText(
      'layer_or_infill_preference',
      'Layer or infill preference',
      40,
      'Describe layer height or infill preferences',
    ),
  ],
  cadPlotting: [
    requiredText(
      'sheet_size',
      'Sheet size',
      10,
      'Enter the required sheet size',
    ),
    requiredText(
      'drawing_scale',
      'Drawing scale',
      20,
      'Enter the drawing scale',
    ),
    requiredText(
      'color_mode',
      'Color mode',
      30,
      'Describe the required color mode',
    ),
    requiredText(
      'folding_or_binding',
      'Folding or binding',
      40,
      'Describe folding or binding requirements',
    ),
  ],
  packaging: [
    requiredText(
      'box_style',
      'Box style',
      10,
      'Describe the requested box style',
    ),
    requiredText(
      'internal_dimensions',
      'Internal dimensions',
      20,
      'Enter the internal length, width, and height',
    ),
    requiredText('material', 'Material', 30, 'Describe the requested material'),
    requiredText('finish', 'Finish', 40, 'Describe the requested finish'),
    {
      key: 'food_grade_requirement',
      label: 'Food-grade requirement',
      helpText: 'Indicate whether food-grade packaging is required.',
      inputType: 'boolean',
      valueType: 'boolean',
      isRequired: true,
      pricingRole: 'none',
      sortOrder: 50,
      options: [],
    },
  ],
} as const;

type CatalogRfqProductInput = Readonly<{
  slug: string;
  name: string;
  description: string;
  examples: readonly string[];
  sortOrder: number;
  fileProcessingType: 'document' | 'model_3d' | 'generic_file';
  quantityUnit: string;
  maxFileSizeMb?: 100 | 200;
  allowedExtensions?: readonly string[];
  specs: readonly Readonly<Record<string, unknown>>[];
}>;

type CatalogRfqProduct = Readonly<
  CatalogRfqProductInput & {
    mobileDescription: string;
    pricingModel: 'quote_required';
    baseRate: 0;
    maxFileSizeMb: 100 | 200;
    allowedExtensions: readonly string[];
    isActive: true;
  }
>;

const rfqProduct = (product: CatalogRfqProductInput): CatalogRfqProduct => ({
  ...product,
  mobileDescription: product.description,
  pricingModel: 'quote_required' as const,
  baseRate: 0,
  maxFileSizeMb: product.maxFileSizeMb ?? 100,
  allowedExtensions: product.allowedExtensions ?? GENERAL_ARTWORK_EXTENSIONS,
  isActive: true,
});

export const CATALOG_V1_10_GROUPS = [
  {
    slug: 'marketing-promo',
    name: 'Marketing & Promotional Collateral',
    description:
      'Best for businesses, startups, and events looking to promote services or distribute physical marketing material.',
    sortOrder: 1,
    products: [
      rfqProduct({
        slug: 'flyers',
        name: 'Flyers',
        description: 'Single sheets, event promos, and product announcements.',
        examples: ['Single sheets', 'Event promos', 'Product announcements'],
        sortOrder: 1,
        fileProcessingType: 'document',
        quantityUnit: 'copy',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
      rfqProduct({
        slug: 'brochures',
        name: 'Brochures',
        description: 'Bi-fold, tri-fold, and company profile brochures.',
        examples: ['Bi-fold', 'Tri-fold', 'Company profiles'],
        sortOrder: 2,
        fileProcessingType: 'document',
        quantityUnit: 'copy',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
      rfqProduct({
        slug: 'posters-standees',
        name: 'Posters & Standees',
        description: 'Indoor event posters, pull-up banners, and x-stands.',
        examples: ['Indoor event posters', 'Pull-up banners', 'X-stands'],
        sortOrder: 3,
        fileProcessingType: 'document',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
      rfqProduct({
        slug: 'business-cards',
        name: 'Business Cards',
        description:
          'Standard, matte, glossy, textured, and QR-code-enabled business cards.',
        examples: [
          'Standard',
          'Matte',
          'Glossy',
          'Textured',
          'QR-code enabled',
        ],
        sortOrder: 4,
        fileProcessingType: 'document',
        quantityUnit: 'card',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
      rfqProduct({
        slug: 'stickers-packaging-labels',
        name: 'Stickers & Packaging Labels',
        description:
          'Die-cut product labels, vinyl stickers, and sheet stickers.',
        examples: [
          'Die-cut product labels',
          'Vinyl stickers',
          'Sheet stickers',
        ],
        sortOrder: 5,
        fileProcessingType: 'document',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
      rfqProduct({
        slug: 'tarpaulins-outdoor-banners',
        name: 'Tarpaulins & Outdoor Banners',
        description: 'Event banners, billboards, and temporary roadside signs.',
        examples: ['Event banners', 'Billboards', 'Temporary roadside signs'],
        sortOrder: 6,
        fileProcessingType: 'document',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.printCollateral,
      }),
    ],
  },
  {
    slug: 'corporate-merch',
    name: 'Corporate & Event Merchandise',
    description:
      'Best for student organizations, HR teams, event organizers, and corporate branding.',
    sortOrder: 2,
    products: [
      rfqProduct({
        slug: 'lanyards-id-accessories',
        name: 'Lanyards & ID Accessories',
        description:
          'Sublimation lanyards, custom ID laces, and badge holders.',
        examples: ['Sublimation lanyards', 'Custom ID laces', 'Badge holders'],
        sortOrder: 1,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.merchandise,
      }),
      rfqProduct({
        slug: 'custom-apparel',
        name: 'Custom Apparel',
        description: 'T-shirts, hoodies, polo shirts, and tote bags.',
        examples: ['T-shirts', 'Hoodies', 'Polo shirts', 'Tote bags'],
        sortOrder: 2,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.merchandise,
      }),
      rfqProduct({
        slug: 'drinkware',
        name: 'Drinkware',
        description:
          'Sublimation mugs, laser-engraved tumblers, and water bottles.',
        examples: [
          'Sublimation mugs',
          'Laser-engraved tumblers',
          'Water bottles',
        ],
        sortOrder: 3,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.merchandise,
      }),
      rfqProduct({
        slug: 'corporate-giveaways',
        name: 'Corporate Giveaways',
        description:
          'Eco-bags, umbrellas, customized pens, keychains, and notebooks.',
        examples: [
          'Eco-bags',
          'Umbrellas',
          'Customized pens',
          'Keychains',
          'Notebooks',
        ],
        sortOrder: 4,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.merchandise,
      }),
    ],
  },
  {
    slug: 'awards-signages',
    name: 'Recognition, Awards & Signage',
    description:
      'Best for competitions, graduations, guest speakers, store branding, and office spaces.',
    sortOrder: 3,
    products: [
      rfqProduct({
        slug: 'certificates-diplomas',
        name: 'Certificates & Diplomas',
        description:
          'Specialty-paper, foil-stamped, and embossed certificates and diplomas.',
        examples: ['Specialty paper', 'Foil-stamped', 'Embossed'],
        sortOrder: 1,
        fileProcessingType: 'generic_file',
        quantityUnit: 'copy',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.awardsAndSignage,
      }),
      rfqProduct({
        slug: 'plaques-trophies',
        name: 'Plaques & Trophies',
        description:
          'Custom acrylic cuts, wooden plaques, and 3D-printed awards.',
        examples: [
          'Custom acrylic cuts',
          'Wooden plaques',
          '3D-printed awards',
        ],
        sortOrder: 2,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.awardsAndSignage,
      }),
      rfqProduct({
        slug: 'medals-ribbons',
        name: 'Medals & Ribbons',
        description: 'Metal or acrylic medals with custom sublimation ribbons.',
        examples: [
          'Metal medals',
          'Acrylic medals',
          'Custom sublimation ribbons',
        ],
        sortOrder: 3,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.awardsAndSignage,
      }),
      rfqProduct({
        slug: 'business-store-signages',
        name: 'Business & Store Signages',
        description:
          'Acrylic build-up letters, Panaflex lightboxes, and LED neon flex.',
        examples: [
          'Acrylic build-up letters',
          'Panaflex lightboxes',
          'LED neon flex',
        ],
        sortOrder: 4,
        fileProcessingType: 'generic_file',
        quantityUnit: 'piece',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.awardsAndSignage,
      }),
    ],
  },
  {
    slug: 'specialized-prototyping',
    name: 'Specialized & Prototyping Services',
    description:
      'Best for architecture students, engineers, industrial designers, and specialized builds.',
    sortOrder: 4,
    products: [
      rfqProduct({
        slug: '3d-printing-scale-models',
        name: '3D Printing & Scale Models',
        description:
          'Rapid prototyping, architectural scale models, and custom parts.',
        examples: [
          'Rapid prototyping',
          'Architectural scale models',
          'Custom parts',
        ],
        sortOrder: 1,
        fileProcessingType: 'model_3d',
        quantityUnit: 'model',
        maxFileSizeMb: 200,
        allowedExtensions: MODEL_3D_EXTENSIONS,
        specs: CATALOG_V1_10_SPEC_TEMPLATES.fabrication3d,
      }),
      rfqProduct({
        slug: 'blueprint-cad-plotting',
        name: 'Blueprint & CAD Plotting',
        description: 'Large-format architectural and engineering plans.',
        examples: ['Large-format architectural plans', 'Engineering plans'],
        sortOrder: 2,
        fileProcessingType: 'document',
        quantityUnit: 'copy',
        allowedExtensions: CAD_EXTENSIONS,
        specs: CATALOG_V1_10_SPEC_TEMPLATES.cadPlotting,
      }),
      rfqProduct({
        slug: 'packaging-box-production',
        name: 'Packaging & Box Production',
        description:
          'Custom product boxes, mailer boxes, and food-grade packaging.',
        examples: [
          'Custom product boxes',
          'Mailer boxes',
          'Food-grade packaging',
        ],
        sortOrder: 3,
        fileProcessingType: 'generic_file',
        quantityUnit: 'box',
        specs: CATALOG_V1_10_SPEC_TEMPLATES.packaging,
      }),
    ],
  },
] as const;

export type CatalogOrderableLeaf = {
  isActive: boolean;
  pricingModel: string;
  groupSlug: string | null;
  groupName: string | null;
  groupDescription: string | null;
  groupSortOrder: number | null;
};

/** The persistence fields which distinguish an orderable RFQ leaf from a group. */
export const isActiveOrderableRfqLeaf = (
  product: CatalogOrderableLeaf,
): boolean =>
  product.isActive === true &&
  product.pricingModel === 'quote_required' &&
  Boolean(product.groupSlug?.trim()) &&
  Boolean(product.groupName?.trim()) &&
  Boolean(product.groupDescription?.trim()) &&
  Number.isInteger(product.groupSortOrder);

export const catalogV110ProductPolicy = (slug: string) => {
  for (const group of CATALOG_V1_10_GROUPS) {
    const product = group.products.find((candidate) => candidate.slug === slug);
    if (product) {
      return {
        allowedExtensions: product.allowedExtensions,
        maxFileSizeMb: product.maxFileSizeMb,
      } as const;
    }
  }
  return null;
};
