# Contributing to Reshma‑Core

First off, thank you for taking the time to contribute! 🎉  
**Reshma‑Core** is the polymorphic e‑commerce engine behind [Reshma Bangles & Boutique](https://reshma-bangles.com). Your contributions make it more robust, scalable, and secure.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [What We Accept](#what-we-accept)
- [Getting Started](#getting-started)
  - [Fork & Clone](#fork--clone)
  - [Local Development (Two Ways)](#local-development-two-ways)
    - [Option A: Native (npm)](#option-a-native-npm)
    - [Option B: Docker Compose (Full Stack)](#option-b-docker-compose-full-stack)
  - [Environment Variables](#environment-variables)
  - [Database Seeding](#database-seeding)
  - [Available Scripts](#available-scripts)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Pull Request Workflow](#pull-request-workflow)
- [Coding Standards](#coding-standards)
  - [TypeScript & Strictness (No `any`!)](#typescript--strictness-no-any)
  - [Input Validation – Zod Mandatory](#input-validation--zod-mandatory)
  - [Code Formatting & Linting](#code-formatting--linting)
  - [Naming Conventions](#naming-conventions)
  - [Documentation](#documentation)
  - [Error Handling & Logging](#error-handling--logging)
- [Security & Hardening](#security--hardening)
- [Testing](#testing)
- [Commit Guidelines (Conventional Commits)](#commit-guidelines-conventional-commits)
- [Branching Strategy](#branching-strategy)
- [Pull Request Template](#pull-request-template)
- [Review Process](#review-process)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Getting Help](#getting-help)

---

## Code of Conduct

We expect all contributors to read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Harassment, trolling, or any form of disrespect will not be tolerated.

---

## What We Accept

We welcome contributions that:

- Fix a bug (especially security‑related issues – see [SECURITY.md](./SECURITY.md))
- Improve performance or scalability
- Add a well‑specified feature that aligns with the project roadmap
- Enhance documentation or examples
- Update dependencies and resolve vulnerability alerts

We **do not** accept:

- Changes that break backward compatibility without a deprecation plan
- Code that bypasses the established validation/authentication layers
- Direct commits to `main` or `release/*` branches
- Introduction of the `any` keyword (see [TypeScript rules](#typescript--strictness-no-any))

---

## Getting Started

### Fork & Clone

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/your-username/reshma-core.git
   cd reshma-core
   ```
3. Add the original repository as `upstream` to keep your fork in sync:  

   ```bash
   git remote add upstream https://github.com/Afzal14786/reshma-core.git
   ```  

### Local Development (Two Ways)  
You can run the entire stack either **natively** (Node.js + local databases) or using **Docker Compose** (which launches MongoDB, Redis, Typesense, the API, and the worker). Choose the method you’re most comfortable with.  

#### Option A: Native (npm)  
**Prerequisites:** Node.js 20+, MongoDB 6+, Redis 7+ installed and running.  
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env – set MONGO_URI, REDIS_URL, etc. (see next section)

# Build TypeScript
npm run build

# Seed the database (optional)
npm run seed

# Start the API in development mode (hot‑reload)
npm run dev
```  

#### Option B: Docker Compose (Full Stack)  

This method spins up **all five services** defined in `docker-compose.yml`:

* `reshma-api` – the Express application
* `reshma-worker` – the BullMQ email worker
* `reshma-db` – MongoDB 7.0
* `reshma-redis` – Redis 7
* `reshma-typesense` – Typesense search engine  

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```  

The API will be available at `http://localhost:5000`.
The Typesense UI (if enabled) runs on `http://localhost:8108`.  

**Important:** When using Docker, the `.env` file must reference the internal service names (e.g., `MONGODB_URI=mongodb://reshma-db:27017/reshmabangles`). The repository’s `docker-compose.yml` already injects those values as environment variables – you don’t need to change them.  

### Environment Variables  
Copy `.env.example` to `.env` and fill in the required values. Below is a quick reference for the most critical ones:  

| Variable               | Purpose                               | Example (native)                                      | Example (Docker)                                      |
|------------------------|---------------------------------------|-------------------------------------------------------|-------------------------------------------------------|
| `PORT`                 | API listening port                    | `5000`                                                | `5000`                                                |
| `MONGO_URI`            | MongoDB connection string             | `mongodb://localhost:27017/reshma-core`               | `mongodb://reshma-db:27017/reshmabangles`             |
| `REDIS_URL`            | Redis connection                      | `redis://localhost:6379`                              | `redis://reshma-redis:6379`                           |
| `JWT_ACCESS_SECRET`    | Short‑lived access token secret       | (generate with `crypto.randomBytes`)                  | same                                                  |
| `JWT_REFRESH_SECRET`   | Refresh token secret                  | (generate with `crypto.randomBytes`)                  | same                                                  |
| `TYPESENSE_HOST`       | Typesense host                        | `localhost`                                           | `reshma-typesense` (internal)                         |
| `TYPESENSE_API_KEY`    | Typesense API key                     | `your-super-secret-key`                               | must match the command in `docker-compose.yml`        |

**Never commit your** `.env` **file**. It is listed in `.gitignore`.  

### Database Seeding  

To populate your local database with initial roles, an admin user, product categories, and demo products, run: 
```bash
npm run seed
```  

This script uses `tsx` to execute `src/db/seed.ts`. It is idempotent – you can safely run it multiple times.  

### Available Scripts  

| Command             | Action                                                                 |
|---------------------|------------------------------------------------------------------------|
| `npm run dev`       | Start development server with hot‑reload (ts-node + nodemon).          |
| `npm run build`     | Compile TypeScript to `dist/` and resolve path aliases (`@modules/*`, `@config/*`, `@shared/*`). |
| `npm run start`     | Run the production build (`dist/server.js`).                           |
| `npm run seed`      | Seed the database with initial data.                                   |
| `npm run format`    | Format all source files using Prettier.                                |
| `npm run format:check` | Check formatting without writing (used in CI).                      |


## How to Contribute  

### Reporting Bugs  
Use the **Bug Report** issue template. Include:  

* Expected vs. actual behaviour
* Steps to reproduce (minimal API calls or code)
* Environment (Node version, OS, Docker or native, relevant logs)
* If the bug is **security‑related**, follow [SECURITY.md](./SECURITY.md) – **do not open a public issue**.  

### Suggesting Features  
Open a **Feature Request** issue. Describe:  

* The problem you’re solving
* Proposed API / behaviour
* How it fits into the existing architecture (e.g., which module, Zod schema changes, new BullMQ queue)

We will discuss and assign the enhancement label if accepted.

### Pull Request Workflow  

1. `Create a branch` from `main` with a descriptive name:  

   ```txt
   feat/add-2fa
   fix/cart-price-calculation
   docs/update-readme
   ```

2. **Make your changes** – follow the Coding Standards.
3. **Run the following checks** locally:

   ```bash
   npm run format      # auto‑format
   npm run build       # ensures TypeScript compiles
   ```

4. **Commit** using Conventional Commits.
5. **Push** to your fork and open a Pull Request (PR) against the `main` branch.
6. **Fill in the PR template** (see Pull Request Template).
7. **Wait for CI** (once configured) – it will run `format:check`, `build`, and eventually security audits.
8. **Address review feedback** – maintainers will request changes.
9. After approval, a **maintainer will squash and merge** your PR. You will be credited in the release notes.  

---  

## Coding Standards  

### TypeScript & Strictness (No any!)  

The `tsconfig.json` enforces a strict subset of TypeScript. **The `any` keyword is completely banned** – any pull request containing `any` will be rejected.  

Key flags you must respect:

* `noImplicitAny` – every parameter/return type must be explicit.
* `strictNullChecks` – always handle undefined and null.
* `noUncheckedIndexedAccess` – prevents out‑of‑bounds array/object access.
* `exactOptionalPropertyTypes` – avoids accidental undefined injection.
* `noImplicitReturns` & `noFallthroughCasesInSwitch` – eliminates logic gaps.  

When you need a dynamic type, use `unknown` + type guards:

```typescript
// Good
function process(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // safe access
  }
}

// Bad
function process(data: any) { ... }
```

### Input Validation – Zod Mandatory  

**Every** incoming request payload (body, query, params) must be validated against a **Zod schema** before reaching business logic. Raw `req.body` access outside of validation middleware is forbidden.

Example from a controller:  

```typescript
import { z } from 'zod';

const createOrderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().positive() })),
  shippingAddress: z.string().min(5),
});

export const createOrder = async (req: Request, res: Response) => {
  const data = createOrderSchema.parse(req.body);
  // ... business logic
};
```

If validation fails, Zod automatically throws a `ZodError` – the global error handler will return a `400` response.  


### Code Formatting & Linting  

We use **Prettier** for automatic formatting. There is no ESLint yet, but you are encouraged to follow consistent patterns.

* Run `npm run format` before every commit.
* Run `npm run format:check` to verify formatting (CI does this).

### Naming Conventions  

| Type                 | Convention          | Example                        |
|----------------------|---------------------|--------------------------------|
| Files (modules)      | kebab-case.ts       | `user-service.ts`              |
| Classes / Models     | PascalCase          | `UserModel`, `CartService`     |
| Functions / Methods  | camelCase           | `calculateTax`, `findById`     |
| Constants            | UPPER_SNAKE_CASE    | `MAX_RETRY_COUNT`              |
| Environment vars     | UPPER_SNAKE_CASE    | `REDIS_URL`                    |  

### Documentation  

* `JSDoc` for every exported function, especially services and controllers.
* Update `CHANGES.md` or `docs/` if you change behaviour or add a new endpoint.
* For new features, add inline comments explaining the “why” (not the “what”).  

### Error Handling & Logging  

* Use the Winston logger (`src/config/logger.ts`). Never `console.log` in production code.
* In catch blocks, always log the error and return a standardised error response.
* Do not leak stack traces to clients in production (the global error handler already strips them).  

---  

## Security & Hardening  

Every contribution must respect the rules defined in [SECURITY.md](./SECURITY.md). Key reminders:

* **Zod validation** is mandatory – no raw input.
* **No SQL/NoSQL injection** – use Mongoose parameterised queries.
* **JWT handling** – never disable signature verification.
* **Sensitive data** – passwords must be hashed with bcrypt; refresh tokens stored in HTTP‑only cookies.
* **Rate limiting** – do not bypass it. New endpoints must be added to the rate‑limit configuration.
* **Environment secrets** – never hardcode credentials.

If you introduce a new endpoint, ensure you add the appropriate authentication/authorisation middleware (`requireAuth`, `requireRole('admin')`).  

---  

## Testing  

> **Current state:** The project does not yet have a test framework installed (we plan to adopt Jest or Vitest). However, contributions are still expected to include **manual test evidence**.  

For **bug fixes:** describe how you reproduced the bug and how your fix resolves it.  
For **new features:** provide a Postman collection, curl commands, or a small script that demonstrates correct behaviour.
For **refactors:** ensure all existing functionality works (smoke test the main flows: registration, login, add to cart, checkout).  

Once tests are introduced, the CI will require `npm test` to pass.  

---  

## Commit Guidelines (Conventional Commits)  

We follow **Conventional Commits** (v1.0.0). This enables automatic changelog generation and semantic versioning.

Format:  
```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```  

**Types:**  
* `feat` – new feature (minor version bump)
* `fix` – bug fix (patch version bump)
* `docs` – documentation only
* `style` – formatting, missing semicolons, etc. (no code change)
* `refactor` – code change that neither fixes a bug nor adds a feature
* `perf` – performance improvement
* `test` – adding missing tests or correcting existing tests
* `build` – changes to build system or dependencies (e.g., npm, TypeScript)
* `ci` – CI configuration (GitHub Actions, etc.)
* `chore` – other changes that don't modify src or test files  

**Scope (optional):** `auth`, `cart`, `orders`, `payments`, `search`, `worker`, etc.  

**Example:** 
```text
feat(orders): add partial refund capability

- Add `refund` method to OrderService
- Validate refund amount against paid amount
- Emit 'order.refunded' event for BullMQ

Closes #142
```  
--- 

## Branching Strategy  

* `main` – production‑ready code. All changes must come through PRs.
* `feat/xxx` – new features.
* `fix/xxx` – bug fixes.
* `docs/xxx` – documentation changes.
* `security/xxx` – sensitive security fixes (coordinate with maintainers first). 

**Never force‑push** to shared branches. Use `--force-with-lease` only on your own forks.  

--- 

## Pull Request Template  
When you open a PR, the following template will automatically appear. Please fill it out completely:

```markdown
## Description
<!-- Explain the change – what and why -->

## Related Issue
<!-- Link to the issue (e.g., "Closes #42") -->

## Type of Change
- [ ] Bug fix (non‑breaking)
- [ ] New feature (non‑breaking)
- [ ] Breaking change (fix or feature that would break existing behaviour)
- [ ] Documentation update

## Checklist
- [ ] My code follows the code style of this project (`npm run format`)
- [ ] I have updated the documentation (if needed)
- [ ] I have added manual test steps or automated tests that prove my fix/feature works
- [ ] I have checked for security implications (Zod validation, no `any`, JWT usage, etc.)
- [ ] The `npm run build` command completes without errors

## Screenshots (if appropriate)
```  

---  

## Review Process  

1. **Automated checks** (format, build, eventual security audit) must pass.
2. **At least one maintainer** approves the changes.
3. For non‑trivial changes, a second maintainer may be requested.
4. You may be asked to:
   * Add more validation or test cases
   * Rewrite commit history (we squash on merge, so not always needed)
   * Update documentation

Once approved and all checks are green, a maintainer will **squash and merge** your PR.  

---  

## Contributor License Agreement (CLA)  

By contributing to Reshma‑Core, you agree that your contributions become the intellectual property of Reshma Bangles & Boutique and may be relicensed for commercial purposes. A full CLA will be presented to you when you submit your first pull request. You will need to sign it (electronically) before the PR can be merged.  

If you are contributing on behalf of a company, please mention that in the PR.

--- 

## Getting Help  

* **GitHub Discussions** – for architectural questions, feature requests, and general help.
* **Email** – `mdafzal14777@gmail.com` (for sensitive issues or private matters).
* **Slack / Discord** – (if available, link will be added later).

We aim to respond to all questions within 48 hours.

---  

**Thank you for helping build Reshma‑Core – the engine that powers real‑world e‑commerce.**  

Your dedication to quality, security, and strict TypeScript makes a difference. 🙌