import { AppDataSource } from '../src/database/data-source';
import { applyParsedCatalogProducts } from '../src/suppliers/supplier-catalog.apply';
import {
  parseCatalogText,
  POLYMEDIA_CATALOG_TEXT,
} from '../src/suppliers/supplier-catalog.parser';

async function main() {
  await AppDataSource.initialize();
  const rows = await AppDataSource.query(
    `SELECT sp.id FROM supplier_profiles sp
     LEFT JOIN users u ON u.id = sp.user_id
     WHERE sp.business_name ILIKE 'Polymedia%'
        OR u.email = 'supplier@gridgo.ph'
     ORDER BY CASE WHEN sp.business_name ILIKE 'Polymedia%' THEN 0 ELSE 1 END
     LIMIT 1`,
  );
  if (!rows[0]) {
    console.log('No supplier@gridgo.ph profile; skip');
    await AppDataSource.destroy();
    return;
  }
  await AppDataSource.query(
    `UPDATE supplier_profiles
        SET business_name = 'Polymedia Printing Services'
      WHERE id = $1`,
    [rows[0].id],
  );
  const parsed = parseCatalogText(POLYMEDIA_CATALOG_TEXT);
  const applied = await applyParsedCatalogProducts(
    AppDataSource,
    rows[0].id,
    parsed.products,
    {
      kind: 'import',
      fileName: 'Polymedia Printing Services Catalog.docx',
    },
  );
  console.log(
    JSON.stringify({
      supplierId: rows[0].id,
      ...applied,
      products: parsed.products.map((p) => p.title),
    }),
  );
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
