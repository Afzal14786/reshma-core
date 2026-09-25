# Test Reports — Reshma-Core

> **Snapshot Date**: 2026-09-26
> **Branch**: `report/tests`
> **Node**: 20.x
> **Environment**: Docker (isolated MongoDB 6.0 replica set + Redis 7)
> **Status**: ✅ All systems green

---

## 🎯 Executive Summary

| Metric | Value | Status |
|--------|-------|:------:|
| **Total Tests** | **501** | ✅ |
| **Test Suites** | **49** | ✅ |
| **Pass Rate** | **100%** | ✅ |
| **Production Bugs Caught** | **24** | 🐛 |
| **Test Categories** | 5 (unit, integration, security, e2e, workers) | ✅ |
| **CI Pipeline** | GitHub Actions (5 parallel jobs) | 🤖 |
| **Coverage Tooling** | Jest + per-suite HTML reports | 📈 |

---

## 📊 Test Suite Overview

| Suite | Suites | Tests | Runtime (w/cov) | Pass Rate |
|-------|--------|-------|-----------------|-----------|
| Unit | 10 | 172 | ~24s | 100% |
| Integration | 25 | 221 | ~4m 52s | 100% |
| Security | 6 | 74 | ~1m 29s | 100% |
| E2E | 4 | 15 | ~44s | 100% |
| Workers | 4 | 19 | ~23s | 100% |
| **TOTAL** | **49** | **501** | **~7m 52s** | **100%** |  


**Without coverage instrumentation:** ~4 minutes total (sequential). **CI parallel:** ~2m 48s.

---

## 📈 Coverage Results (Real Measurements)

Measured via `jest --coverage` per suite, aggregated across all five.

### Coverage Table

| Suite | Statements | Branches | Functions | Lines | Visual |
|-------|:----------:|:--------:|:---------:|:-----:|:-------|
| **unit** | 31.4% | 14.8% | 15.2% | **30.9%** | ███████░░░░░░░░░░░░░░░ |
| **integration** | 60.2% | 40.7% | 55.6% | **60.4%** | █████████████░░░░░░░░░ |
| **security** | 37.3% | 16.2% | 29.8% | **37.1%** | ████████░░░░░░░░░░░░░░ |
| **e2e** | 38.1% | 18.0% | 27.0% | **37.9%** | ████████░░░░░░░░░░░░░░ |
| **workers** | 74.7% | 44.1% | 60.8% | **74.0%** | ████████████████░░░░░░ |
| **AVERAGE** | **48.3%** | **26.8%** | **37.7%** | **48.0%** | ███████████░░░░░░░░░░░ |

**Legend:** `█ ≥ 80%` · `█ 60–80%` · `█ < 60%`

### Understanding Per-Suite Coverage

Each suite runs `jest --coverage` against **all of `src/`** — but only exercises the files it touches. That's why the numbers vary widely.

| Suite | Why this number |
|-------|-----------------|
| **Unit** — 30.9% | Unit tests mock DB/Redis. Only pure logic (services, utils, pricing) is loaded. |
| **Integration** — 60.4% | Loads the full HTTP stack — controllers, services, middlewares, models. Highest system-wide coverage. |
| **Security** — 37.1% | Attacker-perspective tests. Touches only the endpoints being probed. |
| **E2E** — 37.9% | Full journeys, but narrow — walks only the paths users actually take. |
| **Workers** — 74.0% | Well-scoped: BullMQ processors + their direct dependencies. |

**Key insight:** These are **not** additive. The **combined** coverage of the full suite is higher than any single number — the integration suite alone covers 60% of `src/` at the lines level.

---

## 📁 Module-Level Coverage

Line coverage per module, measured across the suites that load them.

### High Coverage (≥ 80%)

| Module | Lines % | Visual |
|--------|:-------:|:-------|
| `src/modules/products/models` | **100%** | ████████████████████████ |
| `src/routes` | **100%** | ████████████████████████ |
| `src/shared/constant` | **100%** | ████████████████████████ |
| `src/modules/wishlists` | **95.1%** | ███████████████████████░ |
| `src/modules/returns` | **91.5%** | ██████████████████████░░ |
| `src/modules/interactions` | **90.9%** | ██████████████████████░░ |
| `src/modules/products/controllers` | **90.9%** | ██████████████████████░░ |
| `src/shared/middlewares` | **76.5%** | ███████████████████░░░░░ |

### Medium Coverage (40–80%)

| Module | Lines % | Visual |
|--------|:-------:|:-------|
| `src/modules/products` | **79.8%** | ███████████████████░░░░░ |
| `src/modules/users` | **80.0%** | ███████████████████░░░░░ |
| `src/modules/orders` | **51.1%** | █████████████░░░░░░░░░░░ |
| `src/modules/cart` | **67.1%** | ████████████████░░░░░░░░ |
| `src/modules/coupons` | **69.4%** | █████████████████░░░░░░░ |
| `src/shared/utils` | **66.0%** | ████████████████░░░░░░░░ |
| `src/shared/queues` | **70.0%** | █████████████████░░░░░░░ |
| `src/config` | **52.7%** | █████████████░░░░░░░░░░░ |
| `src/modules/auth` | **49.3%** | ████████████░░░░░░░░░░░░ |

### Lower Coverage (< 40%)

| Module | Lines % | Notes |
|--------|:-------:|-------|
| `src/modules/notifications` | 21.6% | Templates are data; business logic tested via workers |
| `src/modules/audit-logs` | 17.0% | Read-only admin endpoint; covered by RBAC |
| `src/modules/health` | 12.7% | Simple liveness probe; verified via rate-limit tests |
| `src/modules/admin-search` | 15.6% | Global search proxy; RBAC tests verify access |
| `src/modules/search` | 24.3% | Typesense integration; mocked in tests |
| `src/modules/support` | 14.5% | Newly mounted; RBAC tests verify gating |

**Note:** Lower-coverage modules are usually infrastructure or admin-facing. Their critical paths (auth, RBAC) are verified by the security suite even when line coverage is low.

---

## 🔬 Suite-by-Suite Breakdown

### 🧪 Unit Tests — 10 suites, 172 tests

| Suite | Tests | Purpose |
|-------|:-----:|---------|
| `smoke.test.ts` | 8 | Environment, Redis, path aliases, Express boot |
| `auth/auth.utils.test.ts` | 17 | JWT signing, 2FA secrets, cookie helpers |
| `auth/auth.service.test.ts` | 55 | Register, OTP, login, refresh, 2FA, Google, password reset, logout |
| `pricing/tax.utils.test.ts` | 20 | GST rates, CGST/SGST/IGST, shipping tax |
| `pricing/payment.utils.test.ts` | 9 | Razorpay HMAC signature + webhook verification |
| `coupon/coupon.service.test.ts` | 20 | Create, update, validate, discount firewalls |
| `cart/cart.merge.test.ts` | 16 | Item signature stability, prototype pollution defense |
| `shared/crypto.utils.test.ts` | 13 | Timing-safe compare, AES-256-GCM |
| `shared/sanitizer.test.ts` | 9 | NoSQL operator stripping |
| `shared/app-error.test.ts` | 8 | Error class contract |

**Pass rate:** 100% · **Runtime (w/ coverage):** ~24s

### 🔗 Integration Tests — 25 suites, 221 tests

| Module | Suites | Tests |
|--------|:------:|:-----:|
| Auth | 5 | 28 |
| Cart & Coupons | 2 | 18 |
| Products | 4 | 35 |
| Orders | 5 | 36 |
| Returns | 3 | 25 |
| Users | 3 | 22 |
| Wishlists | 1 | 18 |
| Interactions | 1 | 22 |
| Notifications | 1 | 14 |

**Pass rate:** 100% · **Runtime (w/ coverage):** ~4m 52s

### 🔒 Security Tests — 6 suites, 74 tests

| Suite | Tests | Focus |
|-------|:-----:|-------|
| `idor.int.test.ts` | 14 | Cross-user access denial (404) |
| `rbac.int.test.ts` | 20 | Non-admin denied from admin routes (403) |
| `jwt.int.test.ts` | 11 | Tampered / expired / algorithm-confused tokens |
| `webhook.forgery.int.test.ts` | 8 | Fake Razorpay / Shiprocket signatures |
| `injection.int.test.ts` | 11 | NoSQL operators, prototype pollution |
| `rate-limit.int.test.ts` | 11 | Per-endpoint quota behavior |

**Pass rate:** 100% · **Runtime (w/ coverage):** ~1m 29s

### 🌐 E2E Tests — 4 suites, 15 tests

| Suite | Tests | Journey |
|-------|:-----:|---------|
| `purchase.flow.e2e.test.ts` | 5 | Register → OTP → cart → checkout → pay |
| `return.flow.e2e.test.ts` | 4 | Delivered → return → approve → refund → restock |
| `guest.checkout.e2e.test.ts` | 3 | Guest cart → login → merge → checkout |
| `admin.lifecycle.e2e.test.ts` | 3 | Admin create → buy → deactivate → self-heal |

**Pass rate:** 100% · **Runtime (w/ coverage):** ~44s

### ⚙️ Worker Tests — 4 suites, 19 tests

| Suite | Tests | Focus |
|-------|:-----:|-------|
| `dlq.alert.test.ts` | 5 | Dead-letter alert on exhausted retries |
| `email.worker.test.ts` | 6 | BullMQ email pipeline + attachment bridge |
| `export.worker.test.ts` | 4 | DPDP / GDPR data portability |
| `invoice.worker.test.ts` | 4 | PDF generation + Cloudinary upload |

**Pass rate:** 100% · **Runtime (w/ coverage):** ~23s

---

## 🐛 Production Bugs Caught

**24 bugs.** Every one found **before deployment** by an automated test.

### 🔴 Critical (Money / Data Loss) — 8 bugs

| # | Bug | Impact | Caught By |
|---|-----|--------|:---------:|
| 1 | JWT refresh collision (missing `jti`) | Users logged out mid-session on retry | Security |
| 2 | Refund ratio inflated by tax + shipping | Over-refunded every partial return | Integration |
| 3 | Cart populate ref `"BaseProduct"` (not registered) | Every populated cart read → 500 | Integration |
| 4 | Mongoose internals leaked into JSON | Frontend showed `undefined` for item quantity | Integration |
| 5 | Duplicate cart lines from Map signature mismatch | Same product added twice = two lines | Integration |
| 6 | `validate.middleware` wiped `req.params` | Admin order-status PATCH → 500 | Integration |
| 7 | Notification enum missing `RETURN` type | All return-notifications silently failed | Integration |
| 8 | Support routes never mounted in global router | Entire support module unreachable | Security |

### 🟡 High (Session / Auth) — 7 bugs

| # | Bug | Impact | Caught By |
|---|-----|--------|:---------:|
| 9 | Cookie `sameSite=strict` blocked OAuth | Google sign-in appeared broken | Security |
| 10 | Cookie `expires` used absolute time | Clock-skewed users logged out instantly | Security |
| 11 | Logout cookie lived 10s after logout | Frontend session detection confused | Security |
| 12 | Product discriminators not registered | `bangleSizes`, `sizes`, etc. silently stripped | Integration |
| 13 | Order model same barrel-bypass | Dormant but fragile | Integration |
| 14 | Wishlist model same barrel-bypass | Would crash wishlist population | Integration |
| 15 | JWT algorithm not pinned to HS256 | Algorithm-confusion attack vector | Security |

### 🟢 Medium (Infra / Reliability) — 9 bugs

| # | Bug | Impact | Caught By |
|---|-----|--------|:---------:|
| 16 | Mongoose 9 handshake failure under Jest | All tests blocked | Infra |
| 17 | `process.exit(1)` in config killed test workers | Silent failure on missing env vars | Unit |
| 18 | Error middleware missing 4th param | HTML errors + leaked stack traces | Integration |
| 19 | `trust proxy` missing | All users shared a rate-limit bucket | Security |
| 20 | Health endpoint throttled by standardLimiter | LB pings could take down service | Security |
| 21 | Support routes double-counted standard limiter | Effective quota halved (100 → 50) | Security |
| 22 | Audit-log list route double-prefix | Endpoint unreachable | Security |
| 23 | Wishlist routes missing `protect` | Every wishlist request → 500 | Integration |
| 24 | Wishlist self-heal `.toString()` on populated doc | CastError → 400 when product deactivated | Integration |

**Distribution:**

| Category | Bar | Count | Percentage |
|:---------|:----|------:|-----------:|
| Critical (money/data) | ████████ | 8 | 33% |
| High (session/auth) | ███████ | 7 | 29% |
| Medium (infra) | █████████ | 9 | 38% |  


---

## ⏱️ Runtime Benchmarks

| Suite | Local (no coverage) | Local (with coverage) | CI (parallel) |
|-------|:-------------------:|:---------------------:|:-------------:|
| Unit | ~10s | ~24s | ~1m 15s |
| Integration | ~75s | ~4m 52s | ~2m 48s |
| Security | ~45s | ~1m 29s | ~1m 52s |
| E2E | ~55s | ~44s | ~1m 40s |
| Workers | ~40s | ~23s | ~1m 20s |
| **Sequential Total** | **~4 min** | **~7m 52s** | — |
| **CI (parallel)** | — | — | **~2m 48s** |

**Note:** Coverage instrumentation adds 30–60% overhead on integration (heavy DB I/O). Use `--coverage` only when generating reports.

---

## 🤖 CI/CD Pipeline

| Job | Blocks Merge | Runtime |
|-----|:------------:|:-------:|
| `unit` | Yes | ~1m 15s |
| `integration` | Yes | ~2m 48s |
| `security` | Yes | ~1m 52s |
| `e2e` | Yes | ~1m 40s |
| `workers` | Yes | ~1m 20s |
| `coverage` (informational) | No | ~1m 10s |

**Config:** `.github/workflows/test.yml`
**Badge:** ![Tests](https://github.com/Afzal14786/reshma-core/actions/workflows/test.yml/badge.svg)

---

## 📈 Historical Progression

| Milestone | Tests Added | Cumulative | Bugs Caught |
|-----------|:-----------:|:----------:|:-----------:|
| Phase 0 — Infrastructure | 8 | 8 | 0 |
| Phase 1 — Unit | 172 | 180 | 4 |
| Phase 2 — Integration baseline | 46 | 226 | 2 |
| Priority 1A — Products | 35 | 261 | 3 |
| Priority 1B — Orders | 36 | 297 | 2 |
| Priority 1C — Returns | 25 | 322 | 1 |
| Priority 1D — Modules | 76 | 398 | 2 |
| Priority 2 — Security | 74 | 472 | 6 |
| Priority 3 — E2E | 15 | 487 | 0 |
| Priority 4 — Workers | 19 | **501** | 0 |

---

## 🛠️ How to Regenerate Coverage

### Per-suite interactive HTML reports

```bash
./scripts/coverage-report.sh
```  

This runs all 5 suites with coverage, saves per-suite HTML reports to `coverage/html/<suite>/`, and prints the aggregate table.  

## View in browser  

```bash
python3 -m http.server 8080 --directory coverage/html
```  

Then open:

- [http://localhost:8080/unit/](http://localhost:8080/unit/)
- [http://localhost:8080/integration/](http://localhost:8080/integration/)
- [http://localhost:8080/security/](http://localhost:8080/security/)
- [http://localhost:8080/e2e/](http://localhost:8080/e2e/)
- [http://localhost:8080/workers/](http://localhost:8080/workers/)

Each URL shows a distinct report with line-by-line coverage (green = covered, red = uncovered).  

## Single suite  

```bash
npm run test:cov:unit          # or integration, security, e2e, workers
```  
Prints the Jest text-coverage table directly to the terminal.  

## Coverage artifacts

| Path | Purpose |
|------|---------|
| `coverage/aggregate/*.json` | Machine-readable summaries per suite |
| `coverage/html/<suite>/` | Interactive HTML reports |
| `coverage/coverage-summary.json` | Latest run's aggregate summary |
| `coverage/lcov-report/` | Last suite's raw HTML (overwritten per run) |

## 📋 How to Read This Report

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete, passing |
| 🐛 | Bug found and fixed |
| 📊 | Informational (not a gate) |
| ⚡ | Fast path |
| 🔒 | Security-related |
| 🔴 🟡 🟢 | Severity (critical / high / medium) |

**Bar chart convention:** each `█` ≈ 4% coverage. 25 blocks = 100%.

## 📌 Related Documents

- `tests/README.md` — how to run, write, and debug tests
- `CHANGES.md` — full changelog with per-bug details
- `.github/workflows/test.yml` — CI configuration
- `scripts/coverage-report.sh` — aggregate coverage script

---  

*Last updated: Priority 5 completion — 501 tests, 24 bugs caught, 100% pass rate. Coverage metrics measured via `./scripts/coverage-report.sh`.*