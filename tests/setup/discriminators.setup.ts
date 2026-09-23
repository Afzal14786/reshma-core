// ──────────────────────────────────────────────
// Discriminator registration for INTEGRATION tests
// ──────────────────────────────────────────────
// Mongoose discriminators register as a side effect of importing their
// model files. In unit tests, the base Product model is mocked, so
// loading these files would crash with "Product.discriminator is not a
// function". Only integration tests run this file — where the real
// Product model exists and discriminators can attach cleanly.

import "@modules/products/models/bangle.model";
import "@modules/products/models/apparel.model";
import "@modules/products/models/fabric.model";
import "@modules/products/models/innerwear.model";
import "@modules/products/models/accessory.model";