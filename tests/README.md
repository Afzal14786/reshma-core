# Testing Guide — Reshma-Core

> Production-grade test suite covering **501 automated tests** across five categories (unit, integration, security, E2E, workers). Runs fully isolated in Docker — no access to development or production data is possible.
>
> 📊 **[View the full Test Report →](./REPORTS.md)** — coverage metrics, per-file breakdown, and complete bug log

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Test Categories](#test-categories)
- [Running Tests](#running-tests)
- [Coverage Reports](#coverage-reports)
- [Writing New Tests](#writing-new-tests)
- [Directory Structure](#directory-structure)
- [Test Infrastructure](#test-infrastructure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Quick Start

```bash
# 1. Ensure Docker is running
docker --version

# 2. Run the unit suite (172 tests, ~10s)
npm run test:docker:unit

# 3. Run all 5 suites sequentially (501 tests, ~4 min)
npm run test:docker:all
```  
**That's it**. No local Node install, no manual database setup, no environment configuration.  

### What You Should See  

```test
reshma-test-runner  | PASS UNIT tests/unit/auth/auth.service.test.ts
reshma-test-runner  | PASS UNIT tests/unit/pricing/tax.utils.test.ts
...
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
│  │  │  test-mongo  │  │  test-redis  │  │ 5 test   │  │  │
│  │  │  mongo:6.0   │  │  redis:7     │  │ runners: │  │  │
│  │  │  replica set │  │  password    │  │ unit     │  │  │
│  │  └──────────────┘  └──────────────┘  │ integ    │  │  │
│  │                                       │ security │  │  │
│  │  Live volume mounts:                  │ e2e      │  │  │
│  │    ./src       → /app/src             │ workers  │  │  │
│  │    ./tests     → /app/tests           └──────────┘  │  │
│  │    ./jest.*.ts → /app/jest.*.ts                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```  

### Safety Guarantees  

| Guarantee | How It's Enforced |
|-----------|-------------------|
| No production data access | `tests/setup/env.setup.ts` refuses to run if `MONGO_URI` doesn't contain `test` |
| No real payment charges | Razorpay SDK mocked; integration tests only hit the app's own verification logic |
| No real emails sent | BullMQ email queue captured, never processed (except in worker tests) |
| No real Cloudinary uploads | Cloudinary SDK mocked |
| No real Shiprocket calls | Shiprocket API mocked |
| Isolated network | `reshma-test-network` — separate from dev/prod Docker networks |
| Ephemeral databases | Test containers removed with `docker compose down -v` |  

### Test Categories  

The suite has **501 tests across 5 categories**. Each targets a different layer of the stack.  

| Category | Suites | Tests | Focus | Runtime |
|----------|--------|-------|-------|---------|
| Unit | 10 | 172 | Pure business logic, all I/O mocked | ~10s |
| Integration | 25 | 221 | Real HTTP + MongoDB + Redis | ~75s |
| Security | 6 | 74 | IDOR, RBAC, JWT, webhooks, injection, rate limiting | ~45s |
| E2E | 4 | 15 | Full user journeys across modules | ~55s |
| Workers | 4 | 19 | BullMQ background job processing | ~40s |
| **Total** | **49** | **501** | | **~4 min** |  

### 🧪 Unit Tests — `tests/unit/`  
No database, no Redis, no HTTP. Everything mocked.  

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `auth/auth.utils.test.ts` | 17 | JWT signing, 2FA secrets, cookie helpers |
| `auth/auth.service.test.ts` | 55 | Register, OTP, login, refresh, 2FA, Google OAuth, password reset, logout |
| `pricing/tax.utils.test.ts` | 20 | GST rate resolution, CGST/SGST/IGST, shipping tax |
| `pricing/payment.utils.test.ts` | 9 | Razorpay HMAC + webhook signature verification |
| `coupon/coupon.service.test.ts` | 20 | Create, update, discount firewalls |
| `cart/cart.merge.test.ts` | 16 | Item signature stability, prototype pollution defense |
| `shared/crypto.utils.test.ts` | 13 | Timing-safe compare, AES-256-GCM |
| `shared/sanitizer.test.ts` | 9 | NoSQL operator stripping |
| `shared/app-error.test.ts` | 8 | Error class contract |
| `smoke.test.ts` | 8 | Infrastructure canary |

### 🔗 Integration Tests — `tests/integration/`  

Real Express app, real MongoDB 6.0 replica set, real Redis.  

Covers every HTTP endpoint: auth, cart, coupons, products, orders, returns, users, wishlists, interactions, notifications.  

### 🔒 Security Tests — `tests/security/`  

Attacker-perspective verification:  
- **IDOR** — 404 for cross-user access (hides existence)
- **RBAC** — 403 for non-admin on admin routes
- **JWT** — Tampered, expired, algorithm-confused tokens rejected
- **Webhook** forgery — Invalid HMAC signatures rejected
- **Injection** — NoSQL operators and prototype pollution neutralized
- **Rate limiting** — Per-endpoint quota enforced  

### 🌐 E2E Tests — `tests/e2e/`  

Full user journeys that cross multiple modules:

- Purchase flow: register → OTP → cart → checkout → payment → order confirmed
- Return flow: delivered → return → approve → refund → restock
- Guest cart merge
- Admin product lifecycle  

### ⚙️ Worker Tests — `tests/workers/`  

BullMQ background jobs using real queues + real Redis:

- DLQ alert on exhausted retries
- Email worker pipeline
- Export worker (DPDP / GDPR data portability)
- Invoice worker (PDF + Cloudinary)  

---  

## Running Tests  

### All Available Commands  

| Command | Purpose | Runtime |
|---------|---------|---------|
| `npm run test:docker:unit` | Unit suite | ~10s |
| `npm run test:docker:integration` | Integration suite | ~75s |
| `npm run test:docker:security` | Security suite | ~45s |
| `npm run test:docker:e2e` | E2E suite | ~55s |
| `npm run test:docker:workers` | Worker suite | ~40s |
| `npm run test:docker:all` | All suites sequentially | ~4 min |
| `npm run test:cov:unit` | Unit + coverage table | ~24s |
| `npm run test:cov:all` | All suites + per-suite HTML reports | ~8 min |  

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
npm run test:docker:security
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

grep -a -B 3 -A 20 "● " full.log
```  
The `grep` extracts only the failing test blocks — skips hundreds of lines of Mongo/Redis logs.  

---  

## Coverage Reports  

### Aggregate Coverage (All Suites)  

```bash
./scripts/coverage-report.sh
```  

Runs all 5 suites with coverage, saves per-suite HTML reports to `coverage/html/<suite>/`, and prints an aggregated summary table with color-coded progress bars.  

**Output example:**  

```text
Suite            Stmts %  Branch %   Funcs %   Lines %  Visual
────────────────────────────────────────────────────────────────
unit               31.4     14.8      15.2      30.9  ███████░░░░░░░░░░░░░░░
integration        60.2     40.7      55.6      60.4  █████████████░░░░░░░░░
security           37.3     16.2      29.8      37.1  ████████░░░░░░░░░░░░░░
e2e                38.1     18.0      27.0      37.9  ████████░░░░░░░░░░░░░░
workers            74.7     44.1      60.8      74.0  ████████████████░░░░░░
────────────────────────────────────────────────────────────────
AVERAGE            48.3     26.8      37.7      48.0  ███████████░░░░░░░░░░░
```  

### View Interactive HTML Reports  

```bash
python3 -m http.server 8080 --directory coverage/html
```  

Then open in your browser:

- [http://localhost:8080/unit/](http://localhost:8080/unit/)
- [http://localhost:8080/integration/](http://localhost:8080/integration/)
- [http://localhost:8080/security/](http://localhost:8080/security/)
- [http://localhost:8080/e2e/](http://localhost:8080/e2e/)
- [http://localhost:8080/workers/](http://localhost:8080/workers/)

Each URL shows a line-by-line coverage report for that suite — green (covered) and red (uncovered) highlighted rows.  

### Single Suite Coverage  

```bash
npm run test:cov:unit          # or integration, security, e2e, workers
```  
Prints the Jest text-coverage table directly to the terminal.  

**Full coverage breakdown and interpretation:** [REPORTS.md →](./REPORTS.md)  

---  

## Writing New Tests  

### File Naming Convention  

| Type | Pattern | Location |
|------|---------|----------|
| Unit test | `*.test.ts` | `tests/unit/<module>/` |
| Integration test | `*.int.test.ts` | `tests/integration/<module>/` |
| Security test | `*.int.test.ts` | `tests/security/` |
| E2E test | `*.e2e.test.ts` | `tests/e2e/` |
| Worker test | `*.test.ts` | `tests/workers/` |  

### Test Structure Template  

```typescript
// ──────────────────────────────────────────────
// <Module> — <What this suite verifies>
// ──────────────────────────────────────────────

import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";

describe("<Endpoint or Service>", () => {
  beforeEach(async () => {
    // Reset state (db.setup wipes documents between tests automatically)
  });

  describe("happy path", () => {
    it("does the expected thing", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .post("/api/v1/endpoint")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ /* payload */ });

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

**Test product (all discriminator types):**  
```typescript
import {
  createTestBangle,
  createTestApparel,
  createTestFabric,
  createTestInnerwear,
  createTestAccessory,
} from "@tests/helpers/product.helper";

const product = await createTestBangle({ basePrice: 1500, currentStock: 10 });
```  
**Test order:**  

```typescript
import { createTestOrder, createDeliveredOrder } from "@tests/helpers/order.helper";

const { order, product } = await createDeliveredOrder({ accessToken });
```  

**Return lifecycle:**  
```typescript
import { initiateReturn, arbitrateReturn, processRefund } from "@tests/helpers/return.helper";
```  

**Security assertions:**  

```typescript
import { expectForbidden, expectUnauthorized, expectNotFound } from "@tests/helpers/security.helper";

expectForbidden(res);      // 403
expectUnauthorized(res);   // 401
expectNotFound(res);       // 404 (IDOR denial)
```  

**Response assertions:**  
```typescript
import { expectSuccess, expectError } from "@tests/helpers/request.helper";

expectSuccess(res, 200);
expectError(res, 400);
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
├── REPORTS.md                       ← Coverage + bug log
│
├── setup/                           ← Lifecycle hooks (run by Jest)
│   ├── jest.setup.ts                ← Global: env, timeouts, matchers
│   ├── env.setup.ts                 ← Validates env, blocks non-test DBs
│   ├── db.setup.ts                  ← Mongo lifecycle (connect, wipe)
│   ├── redis.setup.ts               ← Redis lifecycle (connect app client)
│   └── discriminators.setup.ts      ← Registers polymorphic Product model
│
├── helpers/                         ← Reusable test utilities
│   ├── request.helper.ts            ← supertest wrapper + assertions
│   ├── auth.helper.ts               ← User creation, OTP seeding
│   ├── product.helper.ts            ← All 5 discriminator types
│   ├── order.helper.ts              ← createTestOrder, createDeliveredOrder
│   ├── return.helper.ts             ← RMA lifecycle helpers
│   └── security.helper.ts           ← 403/401/404 assertions
│
├── factories/                       ← Deterministic fixtures
│   ├── user.factory.ts
│   ├── coupon.factory.ts
│   ├── product.factory.ts           ← All 5 discriminator payloads
│   ├── order.factory.ts
│   └── return.factory.ts
│
├── mocks/                           ← External dependency mocks
│   ├── cloudinary.mock.ts
│   ├── typesense.mock.ts
│   ├── razorpay.mock.ts
│   ├── email-queue.mock.ts
│   ├── invoice-queue.mock.ts
│   ├── export-queue.mock.ts
│   └── file-type.mock.ts            ← CJS-safe wrapper for ESM package
│
├── unit/                            ← Pure logic (no I/O)
│   ├── smoke.test.ts
│   ├── auth/
│   ├── pricing/
│   ├── coupon/
│   ├── cart/
│   └── shared/
│
├── integration/                     ← Real HTTP + DB + Redis
│   ├── auth/
│   ├── cart/
│   ├── coupons/
│   ├── products/
│   ├── orders/
│   ├── returns/
│   ├── users/
│   ├── wishlists/
│   ├── interactions/
│   └── notifications/
│
├── security/                        ← Attack-surface verification
│   ├── idor.int.test.ts
│   ├── rbac.int.test.ts
│   ├── jwt.int.test.ts
│   ├── webhook.forgery.int.test.ts
│   ├── injection.int.test.ts
│   └── rate-limit.int.test.ts
│
├── e2e/                             ← Full user journeys
│   ├── purchase.flow.e2e.test.ts
│   ├── return.flow.e2e.test.ts
│   ├── guest.checkout.e2e.test.ts
│   └── admin.lifecycle.e2e.test.ts
│
└── workers/                         ← BullMQ background jobs
    ├── dlq.alert.test.ts
    ├── email.worker.test.ts
    ├── export.worker.test.ts
    └── invoice.worker.test.ts
```  

---  

## Test Infrastructure  

### Docker Services  

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| test-mongo | mongo:6.0 | MongoDB replica set (required for transactions) | 27017 |
| test-redis | redis:7-alpine | Ephemeral Redis with password | 6379 |
| test-runner | Dockerfile.test | Unit test runner | — |
| test-integration | Dockerfile.test | Integration test runner | — |
| test-security | Dockerfile.test | Security test runner | — |
| test-e2e | Dockerfile.test | E2E test runner | — |
| test-workers | Dockerfile.test | Worker test runner | — |
| test-smoke | Dockerfile.test | Smoke test runner | — |  

### Why MongoDB 6.0 and Not 7.0  

Mongoose 9.x bundles MongoDB Node Driver v6, which has a handshake incompatibility with MongoDB 7.0's stricter client metadata validation. The server rejects the connection with:  

```text
MongoServerError: Missing required sub-document 'driver' in the client metadata document
```  

We use MongoDB 6.0 in tests — no handshake validation, transactions still work (replica set enabled).  

### Why `driverInfo` in `db.setup.ts`  

Mongoose 9.x determines its driver version via an ESM import lookup. Under `Jest` + `ts-jest`, that lookup breaks and the `driver` sub-document is omitted from the handshake. Explicitly supplying `driverInfo` fixes it without changing production connection code.  

### Why No `dropDatabase()` Between Test Files  

`dropDatabase()` deletes collection indexes. The next test file's first transaction then races against Mongoose's lazy index rebuild, failing with:  

```text
MongoServerError: Unable to acquire IX lock on 'reshma_test.products' within 5ms
```  
We only wipe **documents** (`deleteMany({})`) — indexes persist, tests stay isolated.  

---  

## Troubleshooting  

### Problem: `Missing required sub-document 'driver'`  
Cause: MongoDB 7.0 image used, or `driverInfo` missing.  
Fix: Ensure `docker/test/docker-compose.test.yml` uses `mongo:6.0` and `tests/setup/db.setup.ts` has:  

```typescript
await mongoose.connect(process.env.MONGO_URI!, {
  driverInfo: { name: "reshma-core-tests", version: "1.0.0" },
});
```  

### Problem: `Unable to acquire IX lock within 5ms`  

**Cause**: Test file's `afterAll` calls `dropDatabase()`, causing lazy index rebuilds.  
**Fix**: Remove `dropDatabase()`. Only `deleteMany({})` should be used for cleanup.  

### Problem: The client is closed  

**Cause**: `tests/setup/redis.setup.ts` creates a separate `ioredis` client, but the app uses `node-redis` via `@config/redis`.  
**Fix**: `redis.setup.ts` must connect the app's client:  

```typescript
import { redisClient, connectRedis } from "@config/redis";

beforeAll(async () => {
  if (!redisClient.isOpen) await connectRedis();
});
```  

### Problem: 500 errors with no error message in logs  

**Cause**: `error.middleware.ts` doesn't write to `stderr` in test mode, and Jest mocks `console.*`.  
**Fix**: Ensure `error.middleware.ts` has the test-mode `stderr` write block. Or run:  

```bash
docker logs reshma-test-integration 2>&1 | grep -a -A 20 "Unhandled Error"
```  

### Problem: Tests hang and never exit  
**Cause:** Open MongoDB/Redis/BullMQ handle not closed in `afterAll`.  
**Fix:** Jest is configured with `forceExit: true`. If it still hangs, add `await mongoose.connection.close()` and `await redisClient.quit()` in the appropriate `afterAll`.  

### Problem: EACCES: permission denied on npm install  
**Cause:** node_modules owned by root (from Docker).  
**Fix:**  
```bash
sudo rm -rf node_modules package-lock.json
npm install
```  

### Problem: Docker network still in use after `down`  

**Cause:** Docker network cleanup lag.  
**Fix:** Harmless warning. Force cleanup:  
```bash
docker network prune -f
```  

### Problem: Coverage HTML reports overwrite each other  

**Cause:** Jest's HTML reporter writes to a fixed `coverage/lcov-report/` directory.  
**Fix:** Use `./scripts/coverage-report.sh`, which snapshots each suite's report to `coverage/html/<suite>/` before the next suite overwrites it.  

### Problem: Coverage threshold errors during `test:cov:*` runs  

**Cause:** The base `jest.config.ts` does not enforce a threshold. Individual suites use low thresholds (see their config files).  
**Fix:** Thresholds are calibrated per-suite. See `jest.config.<suite>.ts` files.  

---  

# Contributing

## Adding Tests to a New Module

1. Create the suite directory: `tests/integration/<module>/`
2. Add a factory if needed: `tests/factories/<module>.factory.ts`
3. Add helpers if needed: `tests/helpers/<module>.helper.ts`
4. Write the test suite — follow the template above
5. Run locally: `npm run test:docker:integration`
6. Update the Coverage Matrix in `REPORTS.md`

## PR Checklist

Before opening a PR that adds tests:

- [ ] New tests pass in Docker
- [ ] Existing suites still pass: `npm run test:docker:unit && npm run test:docker:integration && npm run test:docker:security`
- [ ] Factories used instead of inline literals
- [ ] Error paths covered (not just happy paths)
- [ ] No real external service calls (all mocked)
- [ ] `REPORTS.md` updated if the test count changed significantly

## Getting Help

- Check the Troubleshooting section
- Review `REPORTS.md` for coverage details
- Review `CHANGES.md` for the full list of production bugs the suite has caught
- Open an issue if something is unclear

## Test Suite Stats

| Metric | Value |
|--------|-------|
| Total tests | 501 |
| Test suites | 49 |
| Test categories | 5 |
| Full suite runtime | ~4 min (sequential, no coverage) |
| Full suite runtime (with coverage) | ~8 min |
| CI runtime (parallel) | ~2m 48s |
| Production bugs caught | 24 |
| Aggregate coverage (avg) | ~48% |
| Integration coverage | 60.4% (highest system-wide) |

*Last updated: Priority 5 completion. See [REPORTS.md](./REPORTS.md) for full coverage details.*