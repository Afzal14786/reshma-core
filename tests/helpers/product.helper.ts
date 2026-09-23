import { Product } from "@modules/products/models/base-product.model";

import {
  buildBangle,
  buildApparel,
  buildFabric,
  buildInnerwear,
  buildAccessory,
  ProductOverrides,
} from "@tests/factories/product.factory";

/**
 * Creates a real product in the test DB.
 *
 * IMPORTANT: Discriminator registration is handled by
 * `tests/setup/discriminators.setup.ts`, which is loaded only by
 * integration tests. Do NOT add discriminator side-effect imports here —
 * unit tests mock the base Product model and those imports would
 * crash on `Product.discriminator is not a function`.
 */
export async function createTestBangle(o: ProductOverrides = {}) {
  return Product.create(buildBangle(o));
}

export async function createTestApparel(o: ProductOverrides = {}) {
  return Product.create(buildApparel(o));
}

export async function createTestFabric(o: ProductOverrides = {}) {
  return Product.create(buildFabric(o));
}

export async function createTestInnerwear(o: ProductOverrides = {}) {
  return Product.create(buildInnerwear(o));
}

export async function createTestAccessory(o: ProductOverrides = {}) {
  return Product.create(buildAccessory(o));
}

// Backward-compatible alias used by cart/coupon integration tests
export const createTestProduct = createTestBangle;