/**
 * GRIDGO Business product-first catalog:
 * Category (L1) → Subgroup (L2) → Variant leaf (L3) with temporary specs.
 *
 * Called from seed.ts after legacy paper/3d roots are inserted.
 */
import { DataSource } from 'typeorm';

interface IdRow {
  id: number;
}

type FileProcessing = 'document' | 'model_3d' | 'generic_file';
type PricingModel = 'per_page_modifiers' | 'base_plus_material_estimate';

interface VariantSeed {
  name: string;
  slug: string;
  description: string;
  mobileDescription: string;
  baseRate: number;
  quantityUnit: string;
  fileProcessingType?: FileProcessing;
  pricingModel?: PricingModel;
  allowedExtensions?: string[];
  maxFileSizeMb?: number;
  /** Temporary spec template key */
  specTemplate: SpecTemplateKey;
  sortOrder: number;
}

interface SubgroupSeed {
  name: string;
  slug: string;
  description: string;
  mobileDescription: string;
  sortOrder: number;
  variants: VariantSeed[];
}

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  mobileDescription: string;
  audienceLabel: string;
  icon: string;
  sortOrder: number;
  subgroups: SubgroupSeed[];
}

type SpecTemplateKey =
  | 'print_sheet'
  | 'brochure'
  | 'poster_banner'
  | 'business_card'
  | 'sticker'
  | 'tarpaulin'
  | 'lanyard'
  | 'apparel'
  | 'drinkware'
  | 'giveaway'
  | 'certificate'
  | 'plaque'
  | 'medal'
  | 'signage'
  | 'model_3d'
  | 'blueprint'
  | 'packaging';

const DOC_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'docx', 'ai', 'psd'];
const IMAGE_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'ai', 'psd', 'svg'];
const MODEL_EXTS = ['stl', 'obj', '3mf', 'glb', 'gltf'];
const CAD_EXTS = ['pdf', 'dwg', 'dxf', 'plt', 'png'];

const BUSINESS_CATALOG: CategorySeed[] = [
  {
    name: 'Marketing & Promotional Collateral',
    slug: 'marketing-promo',
    description:
      'Physical marketing material for businesses, startups, and events.',
    mobileDescription: 'Flyers, brochures, posters, cards, stickers, banners.',
    audienceLabel:
      'Best for: Businesses, startups, and events looking to promote services or distribute physical marketing material.',
    icon: 'SoundOutlined',
    sortOrder: 10,
    subgroups: [
      {
        name: 'Flyers',
        slug: 'flyers',
        description: 'Single-sheet promotional flyers.',
        mobileDescription: 'Single sheets, event promos, product announcements.',
        sortOrder: 10,
        variants: [
          {
            name: 'Single sheets',
            slug: 'flyers-single-sheets',
            description: 'Standard one-page flyer prints.',
            mobileDescription: 'One-page flyers for general distribution.',
            baseRate: 2.5,
            quantityUnit: 'copy',
            specTemplate: 'print_sheet',
            sortOrder: 10,
          },
          {
            name: 'Event promos',
            slug: 'flyers-event-promos',
            description: 'Event announcement flyers.',
            mobileDescription: 'Flyers tailored for event promotion.',
            baseRate: 2.75,
            quantityUnit: 'copy',
            specTemplate: 'print_sheet',
            sortOrder: 20,
          },
          {
            name: 'Product announcements',
            slug: 'flyers-product-announcements',
            description: 'Product launch and announcement flyers.',
            mobileDescription: 'Announce products and offers on single sheets.',
            baseRate: 2.75,
            quantityUnit: 'copy',
            specTemplate: 'print_sheet',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Brochures',
        slug: 'brochures',
        description: 'Multi-panel folded brochures and company profiles.',
        mobileDescription: 'Bi-fold, tri-fold, and company profiles.',
        sortOrder: 20,
        variants: [
          {
            name: 'Bi-fold',
            slug: 'brochures-bi-fold',
            description: 'Two-panel bi-fold brochure.',
            mobileDescription: 'Classic bi-fold brochure format.',
            baseRate: 8,
            quantityUnit: 'copy',
            specTemplate: 'brochure',
            sortOrder: 10,
          },
          {
            name: 'Tri-fold',
            slug: 'brochures-tri-fold',
            description: 'Three-panel tri-fold brochure.',
            mobileDescription: 'Tri-fold for detailed product or service info.',
            baseRate: 10,
            quantityUnit: 'copy',
            specTemplate: 'brochure',
            sortOrder: 20,
          },
          {
            name: 'Company profiles',
            slug: 'brochures-company-profiles',
            description: 'Multi-page company profile booklets.',
            mobileDescription: 'Company profile and capability brochures.',
            baseRate: 25,
            quantityUnit: 'copy',
            specTemplate: 'brochure',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Posters & Standees',
        slug: 'posters-standees',
        description: 'Indoor posters, pull-up banners, and X-stands.',
        mobileDescription: 'Indoor posters, pull-ups, and X-stands.',
        sortOrder: 30,
        variants: [
          {
            name: 'Indoor event posters',
            slug: 'posters-indoor-event',
            description: 'Large-format indoor event posters.',
            mobileDescription: 'Posters for indoor events and displays.',
            baseRate: 120,
            quantityUnit: 'copy',
            specTemplate: 'poster_banner',
            sortOrder: 10,
          },
          {
            name: 'Pull-up banners',
            slug: 'posters-pull-up-banners',
            description: 'Retractable pull-up banner stands.',
            mobileDescription: 'Portable pull-up banners with stand.',
            baseRate: 1800,
            quantityUnit: 'unit',
            specTemplate: 'poster_banner',
            sortOrder: 20,
          },
          {
            name: 'X-stands',
            slug: 'posters-x-stands',
            description: 'X-banner stand with print insert.',
            mobileDescription: 'Lightweight X-stand banners.',
            baseRate: 950,
            quantityUnit: 'unit',
            specTemplate: 'poster_banner',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Business Cards',
        slug: 'business-cards',
        description: 'Standard and specialty business card finishes.',
        mobileDescription: 'Matte, glossy, textured, and QR-enabled cards.',
        sortOrder: 40,
        variants: [
          {
            name: 'Standard',
            slug: 'business-cards-standard',
            description: 'Standard coated business cards.',
            mobileDescription: 'Everyday standard business cards.',
            baseRate: 0.8,
            quantityUnit: 'card',
            specTemplate: 'business_card',
            sortOrder: 10,
          },
          {
            name: 'Matte',
            slug: 'business-cards-matte',
            description: 'Matte-finish business cards.',
            mobileDescription: 'Soft matte finish cards.',
            baseRate: 1.0,
            quantityUnit: 'card',
            specTemplate: 'business_card',
            sortOrder: 20,
          },
          {
            name: 'Glossy',
            slug: 'business-cards-glossy',
            description: 'High-gloss business cards.',
            mobileDescription: 'Glossy laminated business cards.',
            baseRate: 1.0,
            quantityUnit: 'card',
            specTemplate: 'business_card',
            sortOrder: 30,
          },
          {
            name: 'Textured',
            slug: 'business-cards-textured',
            description: 'Textured specialty stock cards.',
            mobileDescription: 'Premium textured stock cards.',
            baseRate: 1.5,
            quantityUnit: 'card',
            specTemplate: 'business_card',
            sortOrder: 40,
          },
          {
            name: 'QR-code enabled',
            slug: 'business-cards-qr',
            description: 'Business cards with QR code placement.',
            mobileDescription: 'Cards with QR code for digital links.',
            baseRate: 1.2,
            quantityUnit: 'card',
            specTemplate: 'business_card',
            sortOrder: 50,
          },
        ],
      },
      {
        name: 'Stickers & Packaging Labels',
        slug: 'stickers-labels',
        description: 'Die-cut labels, vinyl stickers, and sheet stickers.',
        mobileDescription: 'Die-cut, vinyl, and sheet stickers/labels.',
        sortOrder: 50,
        variants: [
          {
            name: 'Die-cut product labels',
            slug: 'stickers-die-cut-labels',
            description: 'Custom die-cut product labels.',
            mobileDescription: 'Shape-cut labels for products.',
            baseRate: 3.5,
            quantityUnit: 'sheet',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'sticker',
            sortOrder: 10,
          },
          {
            name: 'Vinyl stickers',
            slug: 'stickers-vinyl',
            description: 'Durable vinyl stickers.',
            mobileDescription: 'Weather-resistant vinyl stickers.',
            baseRate: 4.0,
            quantityUnit: 'sheet',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'sticker',
            sortOrder: 20,
          },
          {
            name: 'Sheet stickers',
            slug: 'stickers-sheet',
            description: 'Kiss-cut sticker sheets.',
            mobileDescription: 'Multiple stickers on a single sheet.',
            baseRate: 2.5,
            quantityUnit: 'sheet',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'sticker',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Tarpaulins & Outdoor Banners',
        slug: 'tarpaulins-banners',
        description: 'Outdoor event banners, billboards, and roadside signs.',
        mobileDescription: 'Event banners, billboards, roadside signs.',
        sortOrder: 60,
        variants: [
          {
            name: 'Event banners',
            slug: 'tarpaulins-event-banners',
            description: 'Outdoor event tarpaulin banners.',
            mobileDescription: 'Tarpaulin banners for outdoor events.',
            baseRate: 45,
            quantityUnit: 'sqft',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'tarpaulin',
            sortOrder: 10,
          },
          {
            name: 'Billboards',
            slug: 'tarpaulins-billboards',
            description: 'Large outdoor billboard prints.',
            mobileDescription: 'Large-format billboard tarpaulins.',
            baseRate: 55,
            quantityUnit: 'sqft',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 150,
            specTemplate: 'tarpaulin',
            sortOrder: 20,
          },
          {
            name: 'Temporary roadside signs',
            slug: 'tarpaulins-roadside-signs',
            description: 'Temporary roadside promotional signs.',
            mobileDescription: 'Short-term roadside promotional signs.',
            baseRate: 40,
            quantityUnit: 'sqft',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'tarpaulin',
            sortOrder: 30,
          },
        ],
      },
    ],
  },
  {
    name: 'Corporate & Event Merchandise',
    slug: 'corporate-merchandise',
    description:
      'Branded merch for student orgs, HR teams, and event organizers.',
    mobileDescription: 'Lanyards, apparel, drinkware, and giveaways.',
    audienceLabel:
      'Best for: Student orgs, HR teams, event organizers, and corporate branding.',
    icon: 'GiftOutlined',
    sortOrder: 20,
    subgroups: [
      {
        name: 'Lanyards & ID Accessories',
        slug: 'lanyards-id',
        description: 'Custom lanyards, ID laces, and badge holders.',
        mobileDescription: 'Sublimation lanyards, laces, badge holders.',
        sortOrder: 10,
        variants: [
          {
            name: 'Sublimation lanyards',
            slug: 'lanyards-sublimation',
            description: 'Full-color sublimation lanyards.',
            mobileDescription: 'Full-color dye-sub lanyards.',
            baseRate: 45,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'lanyard',
            sortOrder: 10,
          },
          {
            name: 'Custom ID laces',
            slug: 'lanyards-id-laces',
            description: 'Custom printed ID laces.',
            mobileDescription: 'Printed laces for ID badges.',
            baseRate: 35,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'lanyard',
            sortOrder: 20,
          },
          {
            name: 'Badge holders',
            slug: 'lanyards-badge-holders',
            description: 'Plastic badge holders and reels.',
            mobileDescription: 'Badge holders and accessory packs.',
            baseRate: 25,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'lanyard',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Custom Apparel',
        slug: 'custom-apparel',
        description: 'Printed and embroidered apparel and totes.',
        mobileDescription: 'T-shirts, hoodies, polos, and tote bags.',
        sortOrder: 20,
        variants: [
          {
            name: 'T-shirts',
            slug: 'apparel-tshirts',
            description: 'Custom printed t-shirts.',
            mobileDescription: 'Brand or event t-shirts.',
            baseRate: 280,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'apparel',
            sortOrder: 10,
          },
          {
            name: 'Hoodies',
            slug: 'apparel-hoodies',
            description: 'Custom hoodies.',
            mobileDescription: 'Printed or embroidered hoodies.',
            baseRate: 650,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'apparel',
            sortOrder: 20,
          },
          {
            name: 'Polo shirts',
            slug: 'apparel-polos',
            description: 'Corporate polo shirts.',
            mobileDescription: 'Branded polo shirts for teams.',
            baseRate: 420,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'apparel',
            sortOrder: 30,
          },
          {
            name: 'Tote bags',
            slug: 'apparel-tote-bags',
            description: 'Custom canvas tote bags.',
            mobileDescription: 'Printed tote bags for events.',
            baseRate: 180,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'apparel',
            sortOrder: 40,
          },
        ],
      },
      {
        name: 'Drinkware',
        slug: 'drinkware',
        description: 'Mugs, tumblers, and bottles with custom branding.',
        mobileDescription: 'Mugs, tumblers, and water bottles.',
        sortOrder: 30,
        variants: [
          {
            name: 'Sublimation mugs',
            slug: 'drinkware-sublimation-mugs',
            description: 'Full-wrap sublimation mugs.',
            mobileDescription: 'Custom full-color mugs.',
            baseRate: 220,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'drinkware',
            sortOrder: 10,
          },
          {
            name: 'Laser-engraved tumblers',
            slug: 'drinkware-laser-tumblers',
            description: 'Laser-engraved metal tumblers.',
            mobileDescription: 'Engraved tumblers for gifting.',
            baseRate: 450,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'drinkware',
            sortOrder: 20,
          },
          {
            name: 'Water bottles',
            slug: 'drinkware-water-bottles',
            description: 'Custom branded water bottles.',
            mobileDescription: 'Printed or engraved water bottles.',
            baseRate: 320,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'drinkware',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Corporate Giveaways',
        slug: 'corporate-giveaways',
        description: 'Eco-bags, umbrellas, pens, keychains, notebooks.',
        mobileDescription: 'Eco-bags, pens, keychains, notebooks, umbrellas.',
        sortOrder: 40,
        variants: [
          {
            name: 'Eco-bags',
            slug: 'giveaways-eco-bags',
            description: 'Reusable eco shopping bags.',
            mobileDescription: 'Branded reusable eco-bags.',
            baseRate: 85,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'giveaway',
            sortOrder: 10,
          },
          {
            name: 'Umbrellas',
            slug: 'giveaways-umbrellas',
            description: 'Custom printed umbrellas.',
            mobileDescription: 'Branded foldable umbrellas.',
            baseRate: 280,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'giveaway',
            sortOrder: 20,
          },
          {
            name: 'Customized pens',
            slug: 'giveaways-pens',
            description: 'Custom printed or engraved pens.',
            mobileDescription: 'Branded promotional pens.',
            baseRate: 25,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'giveaway',
            sortOrder: 30,
          },
          {
            name: 'Keychains',
            slug: 'giveaways-keychains',
            description: 'Acrylic or metal custom keychains.',
            mobileDescription: 'Custom keychains for events.',
            baseRate: 45,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'giveaway',
            sortOrder: 40,
          },
          {
            name: 'Notebooks',
            slug: 'giveaways-notebooks',
            description: 'Custom cover notebooks.',
            mobileDescription: 'Branded notebooks and journals.',
            baseRate: 95,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'giveaway',
            sortOrder: 50,
          },
        ],
      },
    ],
  },
  {
    name: 'Recognition, Awards & Signage',
    slug: 'recognition-awards',
    description:
      'Certificates, plaques, medals, and business/store signage.',
    mobileDescription: 'Certificates, plaques, medals, and store signs.',
    audienceLabel:
      'Best for: Competitions, graduations, guest speakers, store branding, and office spaces.',
    icon: 'TrophyOutlined',
    sortOrder: 30,
    subgroups: [
      {
        name: 'Certificates & Diplomas',
        slug: 'certificates-diplomas',
        description: 'Specialty paper, foil-stamped, and embossed certificates.',
        mobileDescription: 'Specialty, foil, and embossed certificates.',
        sortOrder: 10,
        variants: [
          {
            name: 'Specialty paper',
            slug: 'certificates-specialty-paper',
            description: 'Certificates on specialty parchment stock.',
            mobileDescription: 'Premium specialty-paper certificates.',
            baseRate: 35,
            quantityUnit: 'copy',
            specTemplate: 'certificate',
            sortOrder: 10,
          },
          {
            name: 'Foil-stamped',
            slug: 'certificates-foil-stamped',
            description: 'Foil-stamped certificate finishes.',
            mobileDescription: 'Gold/silver foil-stamped certificates.',
            baseRate: 75,
            quantityUnit: 'copy',
            specTemplate: 'certificate',
            sortOrder: 20,
          },
          {
            name: 'Embossed',
            slug: 'certificates-embossed',
            description: 'Embossed seal certificates.',
            mobileDescription: 'Raised-emboss certificate seals.',
            baseRate: 90,
            quantityUnit: 'copy',
            specTemplate: 'certificate',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Plaques & Trophies',
        slug: 'plaques-trophies',
        description: 'Acrylic, wooden, and 3D-printed awards.',
        mobileDescription: 'Acrylic, wood, and 3D-printed awards.',
        sortOrder: 20,
        variants: [
          {
            name: 'Custom acrylic cut',
            slug: 'plaques-acrylic-cut',
            description: 'Laser-cut acrylic plaques and trophies.',
            mobileDescription: 'Custom acrylic award plaques.',
            baseRate: 650,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 80,
            specTemplate: 'plaque',
            sortOrder: 10,
          },
          {
            name: 'Wooden plaques',
            slug: 'plaques-wooden',
            description: 'Engraved wooden award plaques.',
            mobileDescription: 'Wood plaques with metal plate option.',
            baseRate: 850,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 80,
            specTemplate: 'plaque',
            sortOrder: 20,
          },
          {
            name: '3D-printed awards',
            slug: 'plaques-3d-printed',
            description: 'Custom 3D-printed trophy shapes.',
            mobileDescription: '3D-printed custom award forms.',
            baseRate: 1200,
            quantityUnit: 'unit',
            fileProcessingType: 'model_3d',
            pricingModel: 'base_plus_material_estimate',
            allowedExtensions: MODEL_EXTS,
            maxFileSizeMb: 200,
            specTemplate: 'model_3d',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Medals & Ribbons',
        slug: 'medals-ribbons',
        description: 'Metal/acrylic medals with custom ribbons.',
        mobileDescription: 'Medals with sublimation ribbons.',
        sortOrder: 30,
        variants: [
          {
            name: 'Metal medals',
            slug: 'medals-metal',
            description: 'Die-cast or stamped metal medals.',
            mobileDescription: 'Metal medals for competitions.',
            baseRate: 180,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'medal',
            sortOrder: 10,
          },
          {
            name: 'Acrylic medals',
            slug: 'medals-acrylic',
            description: 'Custom acrylic cut medals.',
            mobileDescription: 'Color acrylic competition medals.',
            baseRate: 150,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'medal',
            sortOrder: 20,
          },
          {
            name: 'Custom sublimation ribbons',
            slug: 'medals-sublimation-ribbons',
            description: 'Full-color sublimation medal ribbons.',
            mobileDescription: 'Printed ribbons for medals.',
            baseRate: 45,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            specTemplate: 'medal',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Business & Store Signages',
        slug: 'business-store-signages',
        description: 'Acrylic letters, Panaflex lightboxes, LED neon flex.',
        mobileDescription: 'Build-up letters, lightboxes, LED neon.',
        sortOrder: 40,
        variants: [
          {
            name: 'Acrylic build-up letters',
            slug: 'signage-acrylic-letters',
            description: '3D acrylic build-up letter signage.',
            mobileDescription: 'Dimensional acrylic store letters.',
            baseRate: 350,
            quantityUnit: 'letter',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'signage',
            sortOrder: 10,
          },
          {
            name: 'Panaflex lightboxes',
            slug: 'signage-panaflex-lightboxes',
            description: 'Illuminated Panaflex lightbox signs.',
            mobileDescription: 'Backlit Panaflex store lightboxes.',
            baseRate: 2800,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'signage',
            sortOrder: 20,
          },
          {
            name: 'LED neon flex',
            slug: 'signage-led-neon-flex',
            description: 'Flexible LED neon signage.',
            mobileDescription: 'Custom LED neon flex signs.',
            baseRate: 2200,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'signage',
            sortOrder: 30,
          },
        ],
      },
    ],
  },
  {
    name: 'Specialized & Prototyping Services',
    slug: 'specialized-prototyping',
    description:
      '3D models, CAD plotting, and custom packaging production.',
    mobileDescription: '3D models, blueprints, and custom packaging.',
    audienceLabel:
      'Best for: Architecture students, engineers, industrial designers, and specialized builds.',
    icon: 'ExperimentOutlined',
    sortOrder: 40,
    subgroups: [
      {
        name: '3D Printing & Scale Models',
        slug: '3d-scale-models',
        description: 'Rapid prototyping, architectural models, custom parts.',
        mobileDescription: 'Prototypes, scale models, and custom parts.',
        sortOrder: 10,
        variants: [
          {
            name: 'Rapid prototyping',
            slug: '3d-rapid-prototyping',
            description: 'Fast functional prototypes.',
            mobileDescription: 'Quick-turn functional prototypes.',
            baseRate: 50,
            quantityUnit: 'model',
            fileProcessingType: 'model_3d',
            pricingModel: 'base_plus_material_estimate',
            allowedExtensions: MODEL_EXTS,
            maxFileSizeMb: 200,
            specTemplate: 'model_3d',
            sortOrder: 10,
          },
          {
            name: 'Architectural scale models',
            slug: '3d-architectural-models',
            description: 'Detailed architectural scale models.',
            mobileDescription: 'Architecture presentation models.',
            baseRate: 150,
            quantityUnit: 'model',
            fileProcessingType: 'model_3d',
            pricingModel: 'base_plus_material_estimate',
            allowedExtensions: MODEL_EXTS,
            maxFileSizeMb: 200,
            specTemplate: 'model_3d',
            sortOrder: 20,
          },
          {
            name: 'Custom parts',
            slug: '3d-custom-parts',
            description: 'Custom 3D-printed replacement or design parts.',
            mobileDescription: 'One-off and small-batch custom parts.',
            baseRate: 80,
            quantityUnit: 'model',
            fileProcessingType: 'model_3d',
            pricingModel: 'base_plus_material_estimate',
            allowedExtensions: MODEL_EXTS,
            maxFileSizeMb: 200,
            specTemplate: 'model_3d',
            sortOrder: 30,
          },
        ],
      },
      {
        name: 'Blueprint & CAD Plotting',
        slug: 'blueprint-cad',
        description: 'Large-format architectural and engineering plans.',
        mobileDescription: 'Large-format plan and CAD prints.',
        sortOrder: 20,
        variants: [
          {
            name: 'Architectural plans',
            slug: 'blueprint-architectural',
            description: 'Large-format architectural plan plotting.',
            mobileDescription: 'Architecture blueprint plotting.',
            baseRate: 35,
            quantityUnit: 'sheet',
            fileProcessingType: 'document',
            allowedExtensions: CAD_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'blueprint',
            sortOrder: 10,
          },
          {
            name: 'Engineering plans',
            slug: 'blueprint-engineering',
            description: 'Engineering CAD plan plotting.',
            mobileDescription: 'Engineering drawing plot prints.',
            baseRate: 40,
            quantityUnit: 'sheet',
            fileProcessingType: 'document',
            allowedExtensions: CAD_EXTS,
            maxFileSizeMb: 100,
            specTemplate: 'blueprint',
            sortOrder: 20,
          },
        ],
      },
      {
        name: 'Packaging & Box Production',
        slug: 'packaging-boxes',
        description: 'Custom product, mailer, and food-grade packaging.',
        mobileDescription: 'Product boxes, mailers, food-grade packaging.',
        sortOrder: 30,
        variants: [
          {
            name: 'Custom product boxes',
            slug: 'packaging-product-boxes',
            description: 'Custom die-cut product packaging boxes.',
            mobileDescription: 'Branded product packaging boxes.',
            baseRate: 45,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 80,
            specTemplate: 'packaging',
            sortOrder: 10,
          },
          {
            name: 'Mailer boxes',
            slug: 'packaging-mailer-boxes',
            description: 'E-commerce style mailer boxes.',
            mobileDescription: 'Ship-ready branded mailer boxes.',
            baseRate: 35,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 80,
            specTemplate: 'packaging',
            sortOrder: 20,
          },
          {
            name: 'Food-grade packaging',
            slug: 'packaging-food-grade',
            description: 'Food-safe custom packaging prints.',
            mobileDescription: 'Food-grade labeled packaging.',
            baseRate: 40,
            quantityUnit: 'unit',
            allowedExtensions: IMAGE_EXTS,
            maxFileSizeMb: 80,
            specTemplate: 'packaging',
            sortOrder: 30,
          },
        ],
      },
    ],
  },
];

async function insertCategory(
  ds: DataSource,
  input: {
    name: string;
    slug: string;
    description: string;
    mobileDescription: string;
    audienceLabel?: string | null;
    icon?: string | null;
    parentId?: number | null;
    catalogLevel: number;
    isOrderable: boolean;
    fileProcessingType?: FileProcessing;
    pricingModel?: PricingModel;
    baseRate?: number;
    quantityUnit?: string;
    maxFileSizeMb?: number;
    allowedExtensions?: string[];
    sortOrder: number;
  },
): Promise<number> {
  const [row] = await ds.query(
    `INSERT INTO product_categories (
      name, slug, description, mobile_description, audience_label, icon,
      parent_id, catalog_level, is_orderable,
      file_processing_type, pricing_model, base_rate, quantity_unit,
      max_file_size_mb, allowed_extensions, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,true,$16)
     RETURNING id`,
    [
      input.name,
      input.slug,
      input.description,
      input.mobileDescription,
      input.audienceLabel ?? null,
      input.icon ?? null,
      input.parentId ?? null,
      input.catalogLevel,
      input.isOrderable,
      input.fileProcessingType ?? 'generic_file',
      input.pricingModel ?? 'per_page_modifiers',
      input.baseRate ?? 0,
      input.quantityUnit ?? 'copy',
      input.maxFileSizeMb ?? 50,
      JSON.stringify(input.allowedExtensions ?? []),
      input.sortOrder,
    ],
  );
  return (row as IdRow).id;
}

async function insertSpec(
  ds: DataSource,
  categoryId: number,
  key: string,
  label: string,
  pricingRole: string,
  sortOrder: number,
  options: Array<{
    label: string;
    value: string;
    multiplier?: number;
    fixedFee?: number;
    unitCost?: number;
    isDefault?: boolean;
    sortOrder: number;
  }>,
): Promise<void> {
  const [spec] = await ds.query(
    `INSERT INTO product_spec_definitions (
      category_id, key, label, input_type, value_type, is_required,
      is_active, default_value, pricing_role, sort_order
    )
     VALUES ($1,$2,$3,'select','string',true,true,$4,$5,$6)
     RETURNING id`,
    [
      categoryId,
      key,
      label,
      options.find((o) => o.isDefault)?.value ?? options[0]?.value ?? null,
      pricingRole,
      sortOrder,
    ],
  );
  const specId = (spec as IdRow).id;
  for (const option of options) {
    await ds.query(
      `INSERT INTO product_spec_options (
        spec_definition_id, label, value, multiplier, fixed_fee, unit_cost,
        is_default, is_active, sort_order
      )
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
      [
        specId,
        option.label,
        option.value,
        option.multiplier ?? 1,
        option.fixedFee ?? 0,
        option.unitCost ?? 0,
        option.isDefault ?? false,
        option.sortOrder,
      ],
    );
  }
}

async function seedTemporarySpecs(
  ds: DataSource,
  categoryId: number,
  template: SpecTemplateKey,
): Promise<void> {
  switch (template) {
    case 'print_sheet':
      await insertSpec(ds, categoryId, 'paper_size', 'Paper Size', 'multiplier', 10, [
        { label: 'A5', value: 'a5', multiplier: 0.8, sortOrder: 10 },
        { label: 'A4', value: 'a4', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: 'A3', value: 'a3', multiplier: 1.5, sortOrder: 30 },
        { label: 'Letter', value: 'letter', multiplier: 1, sortOrder: 40 },
      ]);
      await insertSpec(ds, categoryId, 'color_mode', 'Color Mode', 'multiplier', 20, [
        { label: 'B&W', value: 'bw', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Color', value: 'color', multiplier: 2.5, sortOrder: 20 },
      ]);
      await insertSpec(ds, categoryId, 'paper_stock', 'Paper Stock', 'multiplier', 30, [
        { label: 'Matte 120gsm', value: 'matte_120', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Gloss 150gsm', value: 'gloss_150', multiplier: 1.3, sortOrder: 20 },
        { label: 'Cardstock 250gsm', value: 'card_250', multiplier: 1.8, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'print_sides', 'Print Sides', 'multiplier', 40, [
        { label: 'Single-sided', value: 'simplex', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Double-sided', value: 'duplex', multiplier: 1.7, sortOrder: 20 },
      ]);
      break;

    case 'brochure':
      await insertSpec(ds, categoryId, 'finished_size', 'Finished Size', 'multiplier', 10, [
        { label: 'A5', value: 'a5', multiplier: 0.9, sortOrder: 10 },
        { label: 'A4', value: 'a4', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: 'DL', value: 'dl', multiplier: 0.85, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'paper_stock', 'Paper Stock', 'multiplier', 20, [
        { label: 'Matte 150gsm', value: 'matte_150', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Gloss 200gsm', value: 'gloss_200', multiplier: 1.4, sortOrder: 20 },
      ]);
      await insertSpec(ds, categoryId, 'finish', 'Finish', 'fixed_fee', 30, [
        { label: 'None', value: 'none', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Lamination', value: 'lamination', fixedFee: 15, sortOrder: 20 },
        { label: 'Spot UV', value: 'spot_uv', fixedFee: 35, sortOrder: 30 },
      ]);
      break;

    case 'poster_banner':
      await insertSpec(ds, categoryId, 'size', 'Size', 'multiplier', 10, [
        { label: 'A2', value: 'a2', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'A1', value: 'a1', multiplier: 1.6, sortOrder: 20 },
        { label: 'A0', value: 'a0', multiplier: 2.4, sortOrder: 30 },
        { label: '2x5 ft', value: '2x5', multiplier: 2.0, sortOrder: 40 },
        { label: '3x6 ft', value: '3x6', multiplier: 3.0, sortOrder: 50 },
      ]);
      await insertSpec(ds, categoryId, 'material', 'Material', 'multiplier', 20, [
        { label: 'Photo paper', value: 'photo_paper', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Vinyl', value: 'vinyl', multiplier: 1.4, sortOrder: 20 },
        { label: 'Fabric', value: 'fabric', multiplier: 1.8, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'hardware', 'Hardware', 'fixed_fee', 30, [
        { label: 'Print only', value: 'print_only', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'With stand', value: 'with_stand', fixedFee: 450, sortOrder: 20 },
      ]);
      break;

    case 'business_card':
      await insertSpec(ds, categoryId, 'size', 'Size', 'multiplier', 10, [
        { label: 'Standard (3.5×2 in)', value: 'standard', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Square', value: 'square', multiplier: 1.15, sortOrder: 20 },
        { label: 'Mini', value: 'mini', multiplier: 0.9, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'sides', 'Print Sides', 'multiplier', 20, [
        { label: 'Single-sided', value: 'simplex', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Double-sided', value: 'duplex', multiplier: 1.6, sortOrder: 20 },
      ]);
      await insertSpec(ds, categoryId, 'corner', 'Corners', 'fixed_fee', 30, [
        { label: 'Square', value: 'square', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Rounded', value: 'rounded', fixedFee: 20, sortOrder: 20 },
      ]);
      break;

    case 'sticker':
      await insertSpec(ds, categoryId, 'material', 'Material', 'multiplier', 10, [
        { label: 'Paper', value: 'paper', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Vinyl', value: 'vinyl', multiplier: 1.5, sortOrder: 20 },
        { label: 'Clear vinyl', value: 'clear_vinyl', multiplier: 1.8, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'finish', 'Finish', 'multiplier', 20, [
        { label: 'Matte', value: 'matte', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Gloss', value: 'gloss', multiplier: 1.1, sortOrder: 20 },
        { label: 'Waterproof', value: 'waterproof', multiplier: 1.4, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'cut_type', 'Cut Type', 'fixed_fee', 30, [
        { label: 'Kiss-cut', value: 'kiss_cut', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Die-cut', value: 'die_cut', fixedFee: 50, sortOrder: 20 },
      ]);
      break;

    case 'tarpaulin':
      await insertSpec(ds, categoryId, 'finish', 'Finish', 'multiplier', 10, [
        { label: 'Standard', value: 'standard', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Blockout', value: 'blockout', multiplier: 1.25, sortOrder: 20 },
        { label: 'Mesh', value: 'mesh', multiplier: 1.35, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'eyelets', 'Eyelets / Hem', 'fixed_fee', 20, [
        { label: 'None', value: 'none', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Eyelets', value: 'eyelets', fixedFee: 80, sortOrder: 20 },
        { label: 'Hem + eyelets', value: 'hem_eyelets', fixedFee: 150, sortOrder: 30 },
      ]);
      break;

    case 'lanyard':
      await insertSpec(ds, categoryId, 'width', 'Width', 'multiplier', 10, [
        { label: '15mm', value: '15mm', multiplier: 0.9, sortOrder: 10 },
        { label: '20mm', value: '20mm', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: '25mm', value: '25mm', multiplier: 1.15, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'attachment', 'Attachment', 'fixed_fee', 20, [
        { label: 'J-hook', value: 'j_hook', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Breakaway', value: 'breakaway', fixedFee: 8, sortOrder: 20 },
        { label: 'Badge reel', value: 'badge_reel', fixedFee: 25, sortOrder: 30 },
      ]);
      break;

    case 'apparel':
      await insertSpec(ds, categoryId, 'size', 'Size', 'multiplier', 10, [
        { label: 'S', value: 's', multiplier: 1, sortOrder: 10 },
        { label: 'M', value: 'm', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: 'L', value: 'l', multiplier: 1, sortOrder: 30 },
        { label: 'XL', value: 'xl', multiplier: 1.05, sortOrder: 40 },
        { label: '2XL', value: '2xl', multiplier: 1.1, sortOrder: 50 },
      ]);
      await insertSpec(ds, categoryId, 'print_method', 'Print Method', 'multiplier', 20, [
        { label: 'DTF', value: 'dtf', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Screen print', value: 'screen', multiplier: 0.9, sortOrder: 20 },
        { label: 'Embroidery', value: 'embroidery', multiplier: 1.5, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'placement', 'Placement', 'fixed_fee', 30, [
        { label: 'Front only', value: 'front', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Front + back', value: 'front_back', fixedFee: 80, sortOrder: 20 },
      ]);
      break;

    case 'drinkware':
      await insertSpec(ds, categoryId, 'capacity', 'Capacity', 'multiplier', 10, [
        { label: '11oz', value: '11oz', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: '15oz', value: '15oz', multiplier: 1.15, sortOrder: 20 },
        { label: '20oz', value: '20oz', multiplier: 1.3, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'decoration', 'Decoration', 'multiplier', 20, [
        { label: 'Sublimation', value: 'sublimation', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Laser engrave', value: 'laser', multiplier: 1.25, sortOrder: 20 },
        { label: 'UV print', value: 'uv', multiplier: 1.15, sortOrder: 30 },
      ]);
      break;

    case 'giveaway':
      await insertSpec(ds, categoryId, 'branding', 'Branding', 'multiplier', 10, [
        { label: '1-color print', value: '1color', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Full color', value: 'full_color', multiplier: 1.4, sortOrder: 20 },
        { label: 'Laser engrave', value: 'laser', multiplier: 1.3, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'packaging', 'Packaging', 'fixed_fee', 20, [
        { label: 'Bulk pack', value: 'bulk', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Individual wrap', value: 'individual', fixedFee: 5, sortOrder: 20 },
      ]);
      break;

    case 'certificate':
      await insertSpec(ds, categoryId, 'size', 'Size', 'multiplier', 10, [
        { label: 'A4 landscape', value: 'a4_landscape', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'A4 portrait', value: 'a4_portrait', multiplier: 1, sortOrder: 20 },
        { label: 'Letter', value: 'letter', multiplier: 1, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'stock', 'Stock', 'multiplier', 20, [
        { label: 'Parchment', value: 'parchment', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Linen', value: 'linen', multiplier: 1.2, sortOrder: 20 },
        { label: 'Premium card', value: 'premium_card', multiplier: 1.35, sortOrder: 30 },
      ]);
      break;

    case 'plaque':
      await insertSpec(ds, categoryId, 'size', 'Size', 'multiplier', 10, [
        { label: '6×8 in', value: '6x8', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: '8×10 in', value: '8x10', multiplier: 1.4, sortOrder: 20 },
        { label: '10×12 in', value: '10x12', multiplier: 1.8, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'plate', 'Plate Finish', 'fixed_fee', 20, [
        { label: 'Gold', value: 'gold', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Silver', value: 'silver', fixedFee: 0, sortOrder: 20 },
        { label: 'Black metal', value: 'black_metal', fixedFee: 50, sortOrder: 30 },
      ]);
      break;

    case 'medal':
      await insertSpec(ds, categoryId, 'diameter', 'Diameter', 'multiplier', 10, [
        { label: '50mm', value: '50mm', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: '60mm', value: '60mm', multiplier: 1.2, sortOrder: 20 },
        { label: '70mm', value: '70mm', multiplier: 1.4, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'finish', 'Finish', 'multiplier', 20, [
        { label: 'Gold', value: 'gold', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Silver', value: 'silver', multiplier: 1, sortOrder: 20 },
        { label: 'Bronze', value: 'bronze', multiplier: 1, sortOrder: 30 },
        { label: 'Custom color', value: 'custom', multiplier: 1.25, sortOrder: 40 },
      ]);
      break;

    case 'signage':
      await insertSpec(ds, categoryId, 'mounting', 'Mounting', 'fixed_fee', 10, [
        { label: 'None / pickup', value: 'none', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Wall mount kit', value: 'wall_mount', fixedFee: 350, sortOrder: 20 },
        { label: 'Install assist', value: 'install', fixedFee: 1500, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'lighting', 'Lighting', 'multiplier', 20, [
        { label: 'None', value: 'none', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Backlit', value: 'backlit', multiplier: 1.5, sortOrder: 20 },
        { label: 'Front-lit', value: 'front_lit', multiplier: 1.35, sortOrder: 30 },
      ]);
      break;

    case 'model_3d':
      await insertSpec(ds, categoryId, 'material', 'Material', 'unit_cost', 10, [
        { label: 'PLA', value: 'pla', unitCost: 3.5, isDefault: true, sortOrder: 10 },
        { label: 'PETG', value: 'petg', unitCost: 4.5, sortOrder: 20 },
        { label: 'ABS', value: 'abs', unitCost: 4.0, sortOrder: 30 },
        { label: 'Resin', value: 'resin', unitCost: 8.0, sortOrder: 40 },
      ]);
      await insertSpec(ds, categoryId, 'quality', 'Print Quality', 'multiplier', 20, [
        { label: 'Draft (0.28mm)', value: 'draft', multiplier: 0.85, sortOrder: 10 },
        { label: 'Standard (0.2mm)', value: 'standard', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: 'Fine (0.12mm)', value: 'fine', multiplier: 1.4, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'supports', 'Supports', 'fixed_fee', 30, [
        { label: 'Auto', value: 'auto', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'None', value: 'none', fixedFee: 0, sortOrder: 20 },
        { label: 'Manual dense', value: 'dense', fixedFee: 40, sortOrder: 30 },
      ]);
      break;

    case 'blueprint':
      await insertSpec(ds, categoryId, 'paper_size', 'Sheet Size', 'multiplier', 10, [
        { label: 'A3', value: 'a3', multiplier: 0.7, sortOrder: 10 },
        { label: 'A2', value: 'a2', multiplier: 1, isDefault: true, sortOrder: 20 },
        { label: 'A1', value: 'a1', multiplier: 1.6, sortOrder: 30 },
        { label: 'A0', value: 'a0', multiplier: 2.5, sortOrder: 40 },
      ]);
      await insertSpec(ds, categoryId, 'color_mode', 'Color Mode', 'multiplier', 20, [
        { label: 'B&W', value: 'bw', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Color', value: 'color', multiplier: 2.2, sortOrder: 20 },
      ]);
      await insertSpec(ds, categoryId, 'media', 'Media', 'multiplier', 30, [
        { label: 'Bond paper', value: 'bond', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Vellum', value: 'vellum', multiplier: 1.3, sortOrder: 20 },
        { label: 'Polyester film', value: 'polyester', multiplier: 1.8, sortOrder: 30 },
      ]);
      break;

    case 'packaging':
      await insertSpec(ds, categoryId, 'material', 'Material', 'multiplier', 10, [
        { label: 'Corrugated', value: 'corrugated', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: 'Chipboard', value: 'chipboard', multiplier: 1.2, sortOrder: 20 },
        { label: 'Kraft', value: 'kraft', multiplier: 1.1, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'print_coverage', 'Print Coverage', 'multiplier', 20, [
        { label: '1-side 1-color', value: '1s1c', multiplier: 1, isDefault: true, sortOrder: 10 },
        { label: '1-side full color', value: '1s_fc', multiplier: 1.5, sortOrder: 20 },
        { label: '2-side full color', value: '2s_fc', multiplier: 2.0, sortOrder: 30 },
      ]);
      await insertSpec(ds, categoryId, 'finish', 'Finish', 'fixed_fee', 30, [
        { label: 'None', value: 'none', fixedFee: 0, isDefault: true, sortOrder: 10 },
        { label: 'Matte laminate', value: 'matte_lam', fixedFee: 25, sortOrder: 20 },
        { label: 'Gloss laminate', value: 'gloss_lam', fixedFee: 25, sortOrder: 30 },
      ]);
      break;
  }
}

export async function seedBusinessCatalog(ds: DataSource): Promise<{
  categories: number;
  subgroups: number;
  variants: number;
}> {
  let categories = 0;
  let subgroups = 0;
  let variants = 0;

  for (const cat of BUSINESS_CATALOG) {
    const catId = await insertCategory(ds, {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      mobileDescription: cat.mobileDescription,
      audienceLabel: cat.audienceLabel,
      icon: cat.icon,
      catalogLevel: 1,
      isOrderable: false,
      sortOrder: cat.sortOrder,
    });
    categories += 1;

    for (const sub of cat.subgroups) {
      const subId = await insertCategory(ds, {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        mobileDescription: sub.mobileDescription,
        parentId: catId,
        catalogLevel: 2,
        isOrderable: false,
        sortOrder: sub.sortOrder,
      });
      subgroups += 1;

      for (const variant of sub.variants) {
        const variantId = await insertCategory(ds, {
          name: variant.name,
          slug: variant.slug,
          description: variant.description,
          mobileDescription: variant.mobileDescription,
          parentId: subId,
          catalogLevel: 3,
          isOrderable: true,
          fileProcessingType: variant.fileProcessingType ?? 'document',
          pricingModel: variant.pricingModel ?? 'per_page_modifiers',
          baseRate: variant.baseRate,
          quantityUnit: variant.quantityUnit,
          maxFileSizeMb: variant.maxFileSizeMb ?? 50,
          allowedExtensions: variant.allowedExtensions ?? DOC_EXTS,
          sortOrder: variant.sortOrder,
        });
        await seedTemporarySpecs(ds, variantId, variant.specTemplate);
        variants += 1;
      }
    }
  }

  return { categories, subgroups, variants };
}
