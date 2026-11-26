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
  getStorefrontSettings,
  revalidateCatalog,
  searchProducts,
} from './queries';
export type { CatalogSettings, PublishedProductSlug, StorefrontSettings } from './queries';
