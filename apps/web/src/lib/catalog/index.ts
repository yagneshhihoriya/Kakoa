/**
 * Catalog data layer barrel — Module 1 shared interface.
 * Server-only: everything here reaches Postgres via @kakoa/db.
 */
export {
  getCatalogSettings,
  getCategories,
  getLiveStock,
  getProductBySlug,
  getProducts,
  getPublishedProductSlugs,
  revalidateCatalog,
  searchProducts,
} from './queries';
export type { CatalogSettings, PublishedProductSlug } from './queries';
