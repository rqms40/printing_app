import { DataSource } from 'typeorm';
import { AppDataSource } from './src/database/data-source';
import { ProductCategory } from './src/products/entities/product-category.entity';
import { FileProcessingType, PricingModel } from './src/products/enums/catalog.enums';

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(ProductCategory);
  
  const newCategories = [
    {
      name: "Marketing & Promotional Materials",
      slug: "marketing-promo",
      description: "Tarpaulin & Outdoor Banners (Jools Printing) • Brochures / Flyers / Business Cards (Lovis Print Shop) • Posters & Standees / Stickers & Packaging Label (ArtCom)",
      mobileDescription: "Banners, Flyers, Posters, Stickers",
      icon: "NotificationOutlined",
      fileProcessingType: FileProcessingType.GENERIC_FILE,
      pricingModel: PricingModel.BASE_PLUS_MATERIAL_ESTIMATE,
      baseRate: 0.00,
      quantityUnit: "pcs",
      maxFileSizeMb: 100,
      allowedExtensions: ["pdf", "jpg", "png", "ai", "psd"],
      sortOrder: 10,
      isActive: true,
    },
    {
      name: "Corporate & Event Merchandise",
      slug: "corporate-merch",
      description: "Drinkware / Corporate Giveaways (ArtCom) • Custom Apparel / Lanyard & ID Accessories (RMB Rymar's Tailoring and Supplies)",
      mobileDescription: "Mugs, Shirts, Lanyards, Giveaways",
      icon: "SkinOutlined",
      fileProcessingType: FileProcessingType.GENERIC_FILE,
      pricingModel: PricingModel.BASE_PLUS_MATERIAL_ESTIMATE,
      baseRate: 0.00,
      quantityUnit: "pcs",
      maxFileSizeMb: 100,
      allowedExtensions: ["pdf", "jpg", "png", "ai", "psd"],
      sortOrder: 11,
      isActive: true,
    },
    {
      name: "Recognition, Awards & Signages",
      slug: "awards-signages",
      description: "Certificates & Diplomas / Plaques & Trophies / Medals & Ribbon (ArtCom) • DISCLAIMER: No Supplier for Business & Store Signages",
      mobileDescription: "Certificates, Medals, Plaques",
      icon: "TrophyOutlined",
      fileProcessingType: FileProcessingType.GENERIC_FILE,
      pricingModel: PricingModel.BASE_PLUS_MATERIAL_ESTIMATE,
      baseRate: 0.00,
      quantityUnit: "pcs",
      maxFileSizeMb: 100,
      allowedExtensions: ["pdf", "jpg", "png", "ai", "psd"],
      sortOrder: 12,
      isActive: true,
    },
    {
      name: "Specialized & Prototyping Services",
      slug: "specialized-prototyping",
      description: "Blueprint & CAD Plotting (Dara Prints) • 3D Printing / Scale Models / Prototypes (3Deality)",
      mobileDescription: "Blueprints, 3D Models, CAD Plotting",
      icon: "PrinterOutlined",
      fileProcessingType: FileProcessingType.MODEL_3D,
      pricingModel: PricingModel.BASE_PLUS_MATERIAL_ESTIMATE,
      baseRate: 0.00,
      quantityUnit: "pcs",
      maxFileSizeMb: 500,
      allowedExtensions: ["pdf", "dwg", "dxf", "stl", "obj", "step"],
      sortOrder: 13,
      isActive: true,
    }
  ];

  for (const cat of newCategories) {
    const exists = await repo.findOne({ where: { slug: cat.slug } });
    if (!exists) {
      await repo.save(repo.create(cat));
      console.log(`Created: ${cat.name}`);
    } else {
      console.log(`Skipped existing: ${cat.name}`);
    }
  }

  await AppDataSource.destroy();
  console.log("Done");
}

run().catch(console.error);
