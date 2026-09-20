// ──────────────────────────────────────────────
// Reshma-Core Test MongoDB Initialization
// Runs ONLY on first container start.
// Creates test database, collections, and indexes.
// ──────────────────────────────────────────────

db = db.getSiblingDB("reshma_test");

// Create test user with read/write access
db.createUser({
  user: "testrunner",
  pwd: "testpassword123",
  roles: [{ role: "readWrite", db: "reshma_test" }],
});

// ── Core Collections ──
db.createCollection("users");
db.createCollection("products");
db.createCollection("carts");
db.createCollection("orders");
db.createCollection("coupons");
db.createCollection("returns");
db.createCollection("interactions");
db.createCollection("wishlists");
db.createCollection("notifications");
db.createCollection("supporttickets");
db.createCollection("auditlogs");

// ── Indexes ──
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { sparse: true });
db.products.createIndex({ slug: 1 }, { unique: true });
db.products.createIndex({ category: 1, isActive: 1 });
db.products.createIndex({ sku: 1 }, { unique: true, sparse: true });
db.orders.createIndex({ orderNumber: 1 }, { unique: true });
db.orders.createIndex({ userId: 1, createdAt: -1 });
db.carts.createIndex({ userId: 1 }, { unique: true, sparse: true });
db.carts.createIndex({ sessionId: 1 }, { unique: true, sparse: true });
db.coupons.createIndex({ code: 1 }, { unique: true });

print("✅ Reshma-Core test database initialized.");