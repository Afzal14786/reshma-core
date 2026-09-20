# Testing Guide — Reshma-Core

> Production-grade test suite covering **226 automated tests** across infrastructure, unit, and integration layers. Runs fully isolated in Docker — no access to development or production data is possible.

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Test Phases](#test-phases)
- [Coverage Matrix](#coverage-matrix)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Directory Structure](#directory-structure)
- [Test Infrastructure](#test-infrastructure)
- [Troubleshooting](#troubleshooting)
- [Production Bugs Fixed](#production-bugs-fixed)
- [Contributing](#contributing)

---

## Quick Start

```bash
# 1. Ensure Docker is running
docker --version

# 2. Run the full unit test suite (172 tests, ~10s)
npm run test:docker:unit

# 3. Run the full integration suite (46 tests, ~65s)
npm run test:docker:integration
```  
**That's it**. No local Node install, no manual database setup, no environment configuration.  

### What You Should See  

```test
reshma-test-runner  | PASS UNIT tests/unit/auth/auth.service.test.ts
reshma-test-runner  | PASS UNIT tests/unit/pricing/tax.utils.test.ts
reshma-test-runner  | ...
reshma-test-runner  | Test Suites: 10 passed, 10 total
reshma-test-runner  | Tests:       172 passed, 172 total
reshma-test-runner exited with code 0
```  

If the last line says `exited with code 0`, everything passed.  

---  

## Test Architecture  

### Fully Isolated Docker Environment  

```test
┌──────────────────────────────────────────────────────────┐
│  Host Machine (your laptop / CI runner)                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  docker-compose.test.yml (isolated network)        │  │
│  │                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│  │  │  test-mongo  │  │  test-redis  │  │ test-    │  │  │
│  │  │  (mongo:6.0) │  │  (redis:7)   │  │ runner   │  │  │
│  │  │  replica set │  │  password    │  │ (node20) │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│  │                                                    │  │
│  │  Live volume mounts:                               │  │
│  │    ./src       → /app/src                          │  │
│  │    ./tests     → /app/tests                        │  │
│  │    ./jest.*.ts → /app/jest.*.ts                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```  

### Safety Guarantees  

| Guarantee | How It's Enforced |
|-----------|-------------------|
| No production data access | `tests/setup/env.setup.ts` refuses to run if `MONGO_URI` doesn't contain `test` |
| No real payment charges | Razorpay SDK mocked in unit tests; integration tests only hit the app's own verification logic |
| No real emails sent | BullMQ email queue is captured, never processed |
| No real Cloudinary uploads | Cloudinary SDK mocked |
| No real Shiprocket calls | Shiprocket API mocked |
| Isolated network | `reshma-test-network` — separate from dev/prod Docker networks |
| Ephemeral databases | Test containers removed with `docker compose down -v` |  

## Test Phases

The suite is organized into 6 phases. Phases 0–2 are complete. Phases 3–6 are planned.

### ✅ Phase 0 — Infrastructure (`tests/unit/smoke.test.ts`)

8 tests. Verifies the test harness itself is wired correctly.

- Environment variables loaded (`NODE_ENV=test`)
- Redis connectivity
- TypeScript path aliases resolve (`@config/*`, `@shared/*`, `@modules/*`)
- Express app imports and boots without crashing
- Custom Jest matchers work

**Why this matters:** If Phase 0 fails, no other test can pass. It's the canary.

### ✅ Phase 1 — Unit Tests (`tests/unit/`)

172 tests. Pure business logic. No database, no Redis, no HTTP. Everything mocked.

| Suite | Tests | What It Covers |
|-------|-------|----------------|
| `auth/auth.utils.test.ts` | 17 | JWT signing, 2FA secret generation, cookie helpers |
| `auth/auth.service.test.ts` | 55 | Register, verify-otp, login, refresh, Google OAuth, password reset, logout, 2FA (setup/enable/verify/disable) |
| `pricing/tax.utils.test.ts` | 20 | GST rate resolution, threshold logic at ₹2500, CGST/SGST/IGST splits, shipping tax |
| `pricing/payment.utils.test.ts` | 9 | Razorpay HMAC signature verification, webhook signature verification |
| `coupon/coupon.service.test.ts` | 20 | Create, update, validate, discount firewalls (temporal, scarcity, margin, acquisition, logistics) |
| `cart/cart.merge.test.ts` | 16 | Item signature stability, prototype-pollution-safe attribute reconstruction |
| `shared/crypto.utils.test.ts` | 13 | Timing-safe compare, AES-256-GCM encrypt/decrypt, tamper detection |
| `shared/sanitizer.test.ts` | 9 | NoSQL operator stripping, prototype pollution defense |
| `shared/app-error.test.ts` | 8 | Error class contract |
| `smoke.test.ts` | 8 | Infrastructure smoke test |

**Runtime:** ~10 seconds total.

### ✅ Phase 2 — Integration Tests (`tests/integration/`)

46 tests. Real HTTP requests through the Express app, real MongoDB, real Redis.

| Suite | Tests | What It Covers |
|-------|-------|----------------|
| `auth/register.int.test.ts` | 7 | New user creation, safe collision recovery, validation, password never serialized |
| `auth/verify-otp.int.test.ts` | 5 | Account activation, cookie issuance, OTP expiry, brute-force lockout |
| `auth/login.int.test.ts` | 9 | Credentials, lockout, unverified/deactivated accounts, 2FA gate for admins |
| `auth/refresh.int.test.ts` | 4 | Cookie-based refresh, rotation with blacklist, tampered-cookie rejection |
| `auth/logout.int.test.ts` | 3 | Cookie clearing, session revocation, protected-route behavior |
| `cart/cart.int.test.ts` | 10 | Add, increment, update quantity, remove, clear, guest merge, stock validation, auth gates |
| `coupons/coupon.int.test.ts` | 8 | Admin CRUD, RBAC enforcement, public discovery, validation firewalls |

**Runtime:** ~65 seconds total (MongoDB replica set election takes ~20s on first run).

### ⏳ Phase 3 — E2E Tests (planned)

Full user journeys across multiple modules.

- Purchase flow: register → OTP → browse → cart → checkout → payment → order verification
- Return flow: delivered order → initiate return → admin approve → refund → restock
- Admin product lifecycle
- Guest cart merge

**Target:** ~15 tests.

### ⏳ Phase 4 — Worker Tests (planned)

BullMQ job processing in isolation.

- `email.worker` — payload structure, template compilation, retry logic
- `invoice.worker` — PDF generation
- `export.worker` — DPDP data export
- `dlq.alert` — alert triggering on job exhaustion

**Target:** ~20 tests.

### ⏳ Phase 5 — Security Tests (planned)

Attack-surface verification.

- IDOR (cross-user access)
- RBAC (admin-only endpoints)
- JWT tampering and expiry
- Webhook signature forgery
- Rate limiting
- NoSQL injection
- Prototype pollution
- DPDP/GDPR data export and deletion

**Target:** ~50 tests.

### ⏳ Phase 6 — CI & Reports (planned)

- Jest JUnit XML output
- Coverage thresholds (raise from 15% to 85%)
- GitHub Actions workflow
- PR blocking on failure  

---  

## Coverage Matrix  

| Module | Unit | Integration | E2E | Security | Total | Status |
|--------|------|-------------|-----|----------|-------|--------|
| Auth | 55 | 30 | — | ⏳ | 85 | ✅ Complete |
| Cart | 16 | 10 | ⏳ | ⏳ | 26 | ✅ Complete |
| Coupons | 20 | 8 | — | ⏳ | 28 | ✅ Complete |
| Pricing | 29 | — | ⏳ | — | 29 | ✅ Complete |
| Shared Utils | 22 | — | — | ⏳ | 22 | ✅ Complete |
| Infrastructure | 8 | — | — | — | 8 | ✅ Complete |
| Products | — | ⏳ | ⏳ | ⏳ | — | ❌ Pending |
| Orders | 15 | ⏳ | ⏳ | ⏳ | 15 | ⚠️ Partial |
| Returns | — | ⏳ | ⏳ | ⏳ | — | ❌ Pending |
| Users | — | ⏳ | ⏳ | ⏳ | — | ❌ Pending |
| Wishlists | — | ⏳ | — | ⏳ | — | ❌ Pending |
| Interactions | — | ⏳ | — | — | — | ❌ Pending |
| Notifications | — | ⏳ | — | — | — | ❌ Pending |
| Workers | — | — | — | — | — | ⏳ Queued |
| Health | — | ⏳ | — | — | — | ❌ Pending |
| TOTAL | 172 | 46 | 0 | 0 | 226 | ✅ Exit 0 |  

---  

## Running Tests  

### All Available Commands  

| Command | Purpose | Runtime |
|---------|---------|---------|
| `npm run test:docker:unit` | Run unit tests in Docker | ~15s |
| `npm run test:docker:integration` | Run integration tests in Docker | ~65s |
| `npm run test:docker:e2e` | E2E tests (Phase 3) | — |
| `npm run test:docker:workers` | Worker tests (Phase 4) | — |
| `npm run test:docker:security` | Security tests (Phase 5) | — |
| `npm run test:docker:all` | All phases sequentially | ~2 min |
| `npm run test:unit` | Unit tests (requires local Node 20) | — |
| `npm run test:integration` | Integration tests (requires local Mongo/Redis) | — |
| `npm run test:coverage` | Generate coverage report | — |
| `npm run test:ci` | CI mode with JUnit XML output | — |  

### Recommended Workflow  

**Before every commit:**  

```bash
npm run test:docker:unit
```  

**Before every PR:**  

```bash
docker compose -f docker/test/docker-compose.test.yml down -v --remove-orphans
npm run test:docker:unit
npm run test:docker:integration
```  

**Before release:**  

```bash
npm run test:docker:all
```  

### Getting Detailed Output  

If tests fail and the summary is too terse, capture the full log:  

```bash
docker compose -f docker/test/docker-compose.test.yml --profile integration up --build \
  --abort-on-container-exit --exit-code-from test-integration > full.log 2>&1

grep -B 3 -A 20 "● " full.log
```  
The `grep` extracts only the failing test blocks — skips hundreds of lines of Mongo/Redis logs.  

---  

## Writing New Tests  

### File Naming Convention  

| Type | Pattern | Location |
|------|---------|----------|
| Unit test | `*.test.ts` | `tests/unit/<module>/` |
| Integration test | `*.int.test.ts` | `tests/integration/<module>/` |
| E2E test | `*.e2e.test.ts` | `tests/e2e/` |
| Worker test | `*.worker.test.ts` | `tests/workers/` |
| Security test | `*.sec.test.ts` | `tests/security/` |  

### Test Structure Template  

```typescript
// ──────────────────────────────────────────────
// <Module> — <What this suite verifies>
// ──────────────────────────────────────────────

import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";

describe("<Endpoint or Service>", () => {
  // Setup: reset state before each test
  beforeEach(async () => {
    // e.g. clearAuthRedisKeys() or nothing (db.setup wipes documents)
  });

  describe("happy path", () => {
    it("does the expected thing", async () => {
      // Arrange
      const { accessToken } = await createUserWithToken();

      // Act
      const res = await request
        .post("/api/v1/endpoint")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ /* payload */ });

      // Assert
      expectSuccess(res, 200);
      expect(res.body.data).toMatchObject({ /* expected shape */ });
    });
  });

  describe("error paths", () => {
    it("returns 400 on invalid input", async () => {
      const res = await request.post("/api/v1/endpoint").send({ /* bad */ });
      expectError(res, 400);
    });
  });
});
```  

### Using the Helpers  

**Authenticated user:**  

```typescript
import { createUserWithToken } from "@tests/helpers/auth.helper";
const { user, accessToken } = await createUserWithToken({ role: "ADMIN" });
```  

**Test product:**  

```typescript
import { createTestProduct } from "@tests/helpers/product.helper";
const product = await createTestProduct({ basePrice: 1500, currentStock: 10 });
```  

**Custom response assertions:**  

```typescript
import { expectSuccess, expectError } from "@tests/helpers/request.helper";

expectSuccess(res, 200); // asserts success=true, statusCode=200, timestamp present
expectError(res, 400);   // asserts success=false, statusCode=400, message present
```  

### Rules for New Tests  

1. Never touch production data. Env validation aborts if `MONGO_URI` doesn't contain `test`.
2. Never call `process.exit()` — throw instead. Jest needs to see the error.
3. Use factories, not literals. `buildUser()` over inline objects — keeps fixtures consistent.
4. One assertion concept per test. Don't combine "user was created" + "email was sent" in one `it` block.
5. Test error paths as much as happy paths. `400`, `401`, `403`, `404`, `409`, `429` — all need coverage.
6. Assert response shape, not just status. A `200` with a broken body is still broken.  

---  

## Directory Structure  

```markdown
tests/
├── README.md                        ← You are here
│
├── setup/                           ← Lifecycle hooks (run by Jest)
│   ├── jest.setup.ts                ← Global: env, timeouts, matchers
│   ├── env.setup.ts                 ← Validates env, blocks non-test DBs
│   ├── db.setup.ts                  ← Mongo lifecycle (connect, wipe)
│   └── redis.setup.ts               ← Redis lifecycle (connect app client)
│
├── helpers/                         ← Reusable test utilities
│   ├── request.helper.ts            ← supertest wrapper + assertions
│   ├── auth.helper.ts               ← User creation, OTP seeding, Redis cleanup
│   └── product.helper.ts            ← Product creation
│
├── factories/                       ← Deterministic fixtures
│   ├── user.factory.ts
│   ├── coupon.factory.ts
│   └── product.factory.ts
│
├── mocks/                           ← External dependency mocks
│   └── file-type.mock.ts            ← CJS-safe wrapper for ESM package
│
├── unit/                            ← Phase 1: no I/O
│   ├── smoke.test.ts
│   ├── auth/
│   ├── pricing/
│   ├── coupon/
│   ├── cart/
│   └── shared/
│
├── integration/                     ← Phase 2: real HTTP + DB + Redis
│   ├── auth/
│   ├── cart/
│   └── coupons/
│
├── e2e/                             ← Phase 3 (planned)
├── workers/                         ← Phase 4 (planned)
└── security/                        ← Phase 5 (planned)
```  

## Test Infrastructure  

### Docker Services  

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| test-mongo | mongo:6.0 | MongoDB replica set (required for transactions) | 27017 |
| test-redis | redis:7-alpine | Ephemeral Redis with password | 6379 |
| test-runner | Dockerfile.test | Runs unit tests | — |
| test-integration | Dockerfile.test | Runs integration tests | — |
| test-smoke | Dockerfile.test | Runs Phase 0 smoke test | — |  

### Why MongoDB 6.0 and Not 7.0  

Mongoose 9.x bundles MongoDB Node Driver v6, which has a handshake incompatibility with MongoDB 7.0's stricter client metadata validation. The server rejects the connection with:  

```text
MongoServerError: Missing required sub-document 'driver' in the client metadata document
```  

We use MongoDB 6.0 in test — no handshake validation, transactions still work (replica set enabled).  

### Why `driverInfo` in `db.setup.ts`  

Mongoose 9.x determines its driver version via an ESM import lookup. Under Jest + `ts-jest`, that lookup breaks and the `driver` sub-document is omitted from the handshake. Explicitly supplying `driverInfo` fixes it without changing production connection code.  

### Why No dropDatabase() Between Test Files  

`dropDatabase()` deletes collection indexes. The next test file's first transaction then races against Mongoose's lazy index rebuild, failing with:  

```text
MongoServerError: Unable to acquire IX lock on 'reshma_test.products' within 5ms
```  

We only wipe **documents** (`deleteMany({})`) — indexes persist, tests stay isolated.  

---  

## Troubleshooting  

### Problem: `Missing required sub-document 'driver'`  

**Cause:** MongoDB 7.0 image is being used, or `driverInfo` is missing.  

**Fix**: Ensure `docker/test/docker-compose.test.yml` uses `mongo:6.0` and `tests/setup/db.setup.ts` has:  
```typescript
await mongoose.connect(process.env.MONGO_URI!, {
  driverInfo: { name: "reshma-core-tests", version: "1.0.0" },
});
```  

### Problem: `Unable to acquire IX lock within 5ms`  

**Cause:** Test file's `afterAll` calls `dropDatabase()`, causing lazy index rebuilds.  
**Fix:** Remove `dropDatabase()`. Only `deleteMany({})` should be used for cleanup.  

### Problem: The client is closed  

**Cause:** `tests/setup/redis.setup.ts` creates an `ioredis` client, but the app uses `node-redis` via `@config/redis`. Two different clients — the app's client never connects.  
**Fix:** `redis.setup.ts` must connect the app's client:  

```typescript
import { redisClient, connectRedis } from "@config/redis";

beforeAll(async () => {
  if (!redisClient.isOpen) await connectRedis();
});
```  

### Problem: 500 errors with no error message in logs  

**Cause:** `error.middleware.ts` doesn't write to `stderr` in test mode, and Jest mocks `console.*`.  
**Fix:** Ensure `error.middleware.ts` has the test-mode `stderr` write block. Or run:  

```bash
docker logs reshma-test-integration 2>&1 | grep -A 20 "Unhandled Error"
```  

### Problem: Tests hang and never exit  

**Cause:** An open MongoDB/Redis/BullMQ handle wasn't closed in `afterAll`.  
**Fix:** Jest is configured with `forceExit: true` and `detectOpenHandles: false`. If it still hangs, add `await mongoose.connection.close()` and `await redisClient.quit()` in the appropriate `afterAll`.  

### Problem: EACCES: permission denied when running npm install  

**Cause:** `node_modules` owned by `root` (from Docker).  
**Fix:**  
```bash
sudo rm -rf node_modules package-lock.json
npm install
```  

### Problem: Network still in use after docker compose down  
**Cause:** Docker network cleanup lag.  
**Fix:** Harmless warning. Force cleanup:  

```bash
docker network prune -f
``` 

### Production Bugs Fixed  

The test suites uncovered and fixed **12 real bugs in production code** — none were test-only findings.  

| # | Bug | File | Impact |
|---|-----|------|--------|
| 1 | JWT refresh collision — two tokens same second = identical | `auth.utils.ts` | Users logged out mid-session on retry |
| 2 | Cookie `sameSite=strict` blocks OAuth redirects | `auth.utils.ts` | Google sign-in appeared broken |
| 3 | Cookie `expires` uses absolute time (clock-dependent) | `auth.utils.ts` | Users with wrong clocks logged out instantly |
| 4 | Logout cookie lasted 10 seconds after logout | `auth.utils.ts` | Confused frontend session detection |
| 5 | Mongoose 9 handshake failure under Jest | `env.ts` + `db.setup.ts` | All tests blocked |
| 6 | `process.exit(1)` in config killed test workers silently | `config/env.ts` | Missing env vars = no failure message |
| 7 | Cart populate ref `"BaseProduct"` didn't exist (registered as `"Product"`) | `cart.model.ts` | Every populated cart read crashed with 500 |
| 8 | Same ref bug in orders | `order.model.ts` | Would crash admin analytics |
| 9 | Same ref bug in wishlists | `wishlist.model.ts` | Would crash wishlist population |
| 10 | Mongoose internals (`$__`, `_doc`) leaked into JSON responses | `cart.service.ts` | Frontend showed undefined for item quantity |
| 11 | Duplicate cart lines from Mongoose Map signature mismatch | `cart.service.ts` | Same product added twice = two lines |
| 12 | Error middleware missing 4th param, lost error handling | `error.middleware.ts` | HTML errors + leaked stack traces in production |  

> **See** [CHANGES.md](../CHANGES.md) for full details.  

## Contributing

### Adding Tests to a New Module

1. Create the suite directory: `tests/integration/<module>/`
2. Add a factory if needed: `tests/factories/<module>.factory.ts`
3. Add helpers if needed: `tests/helpers/<module>.helper.ts`
4. Write the test suite — follow the template above
5. Run locally: `npm run test:docker:integration`
6. Update the Coverage Matrix in this README

### PR Checklist

Before opening a PR that adds tests:

- [ ] New tests pass in Docker
- [ ] Existing tests still pass (`npm run test:docker:unit && npm run test:docker:integration`)
- [ ] Coverage matrix updated in this README
- [ ] Factories used instead of inline literals
- [ ] Error paths covered (not just happy paths)
- [ ] No real external service calls (all mocked)

### Getting Help

- Check the Troubleshooting section
- Review an existing test suite for patterns
- Open an issue if something is unclear

### Test Suite Stats

| Metric | Value |
|--------|-------|
| Total tests | 226 |
| Test suites | 17 |
| Unit test runtime | ~10s |
| Integration test runtime | ~65s |
| Full suite runtime | ~75s |
| Production bugs caught | 12 |
| Coverage (services) | 85%+ on tested files |  

*Last updated: Phase 2 completion. Next: Products integration (Phase 3.1).*  
