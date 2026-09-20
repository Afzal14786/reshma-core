import { Product } from "@modules/products/models/base-product.model";
import {
  buildProductPayload,
  ProductOverrides,
} from "@tests/factories/product.factory";

/**
 * Creates a real product in the test MongoDB.
 * Uses the base Product model — itemType is stored as a value (no discriminator required).
 */
export async function createTestProduct(overrides: ProductOverrides = {}) {
  const payload = buildProductPayload(overrides);
  return Product.create(payload);
}