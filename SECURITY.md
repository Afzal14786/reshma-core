# Security Policy

Security is the foundational layer of the **Reshma-Core engine**. Because this polymorphic e-commerce system processes financial transactions via Razorpay, handles shipping logistics via **Shiprocket**, and manages **personally identifiable information** (*PII*), we operate under a zero-trust architecture. We treat all external input as hostile and leverage automated **Static Application Security Testing** (*CodeQL*), **supply chain monitoring** (*Dependabot*), and strict branch protection to minimize attack vectors.

## Supported Versions

We actively secure the **current major release** and the **immediate previous major release**. Older versions receive no security updates.

| Version       | Supported          | Status             |
| ------------- | ------------------ | ------------------ |
| 1.x.x         | :white_check_mark: | Active development |
| 0.x.x (legacy)| :x:                | End of Life (EOL)  |

> **Why 1.x?** The project is currently at `1.0.0` (see `package.json`). Version numbers will follow semantic versioning. The next major release (2.0) will be supported alongside 1.x for 6 months after its general availability.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue.** Public disclosure of a vulnerability – especially one that affects payment flows, JWT handling, or database injection – puts our merchants and end‑users at immediate risk.

### Private Reporting Channels

1. **Email** (preferred)  
   Send a detailed report to `mdafzal14777@gmail.com`.  
   PGP key available upon request – encrypt if the vulnerability is extremely sensitive.

2. **GitHub Private Vulnerability Reporting**  
   If enabled on this repository, use the “Report a vulnerability” tab under the “Security” tab.

### What to Include in Your Report

- **Description** of the vulnerability (e.g., “NoSQL injection in product search”, “JWT alg none bypass”).
- **Proof of concept (PoC)** – minimal, reproducible steps or code.
- **Potential impact** – what an attacker could achieve (data exfiltration, privilege escalation, payment manipulation).
- **Affected components** – route, controller, service, or third‑party library.
- **Suggested fix** (optional but appreciated).

### Response Timeline

| Step                         | Expected Time                      |
| ---------------------------- | ---------------------------------- |
| Acknowledgment of receipt    | Within 48 hours                    |
| Triage & impact assessment   | 3–5 business days                  |
| Fix / mitigation delivery    | 7–10 business days (depending on severity) |
| Public advisory (if needed)  | 2 weeks after fix is deployed      |

We will keep you updated on the progress. **Responsible disclosure is highly valued** – we will publicly credit you in the security advisory (unless you prefer anonymity).

## Security Hardening Standards

Every line of code merged into Reshma‑Core must respect the following non‑negotiable rules.

### 1. Input Validation & Firewalls
- **All incoming payloads** (body, query, params) **must** be validated against **Zod DTOs** before reaching any business logic.
- No raw `req.body` access outside of validated middleware.
- File uploads (multer) are validated for size, type, and sanitized before storage.

### 2. Authentication & Session Management
- **Stateless JWT** only – no server‑side session store.
- Access tokens live **15 minutes**, refresh tokens **7 days** (stored in HTTP‑only, secure, SameSite=Strict cookies).
- JWT algorithm **must be RS256 or HS256** (with a strong, rotated secret). Never accept `alg: none`.
- Role‑Based Access Control (RBAC) enforced on every protected endpoint.

### 3. Database Security (MongoDB / Mongoose)
- All database queries use **Mongoose parameterisation** – string concatenation is forbidden.
- Schema validation at both Mongoose **and** Zod level (defence in depth).
- No usage of `$where` or raw JavaScript execution.
- Sensitive fields (`password`, `refreshToken`) are excluded from query results by default.

### 4. TypeScript & Compiler Hardening
The `tsconfig.json` enforces strict security‑relevant flags:
- `noImplicitAny` – every parameter/return type must be explicit.
- `strictNullChecks` – eliminates undefined/null propagation bugs.
- `noUncheckedIndexedAccess` – prevents out‑of‑bounds array/object access.
- `exactOptionalPropertyTypes` – avoids accidental `undefined` injection.
- `noImplicitReturns` & `noFallthroughCasesInSwitch` – eliminates logic gaps.

**Rule:** The `any` keyword is banned in pull requests. Use `unknown` + type guards where dynamic types are unavoidable.

### 5. Environment & Secrets
- `.env` files are **never committed** to version control.
- Use `.env.example` with dummy values for local development.
- Production secrets (DB password, JWT secret, Razorpay keys, Redis password) are injected via **environment variables** or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault). No hardcoded values.

### 6. Rate Limiting & DDoS Protection
- **Express Rate Limit** with **Redis store** (`rate-limit-redis`) – each endpoint family has tailored limits:
  - Authentication endpoints: 5 attempts per 15 minutes per IP.
  - Public API: 100 requests per minute per IP.
  - Admin endpoints: 200 per minute.
- Redis is also used for BullMQ queues – ensure Redis is not exposed to public internet.

### 7. Secure Headers & Transport
- **Helmet** middleware active – sets `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and disables `X-Powered-By`.
- CORS configured with explicit allowed origins (no `*` in production).
- TLS 1.3 only (enforced at reverse proxy level – e.g., Nginx, AWS ALB).

### 8. Output Sanitization
- No direct reflection of user input in error messages or HTML.
- JSON responses never leak stack traces in production (global error handler strips `err.stack`).

### 9. Dependency Security
- Dependabot runs daily – PRs for any critical/high vulnerability must be merged within 48 hours.
- Automated `npm audit` in CI pipeline – build fails on moderate or higher severity.
- Only trusted packages (see `package.json` – all dependencies are well‑maintained; no wildcard versions).

## Automated Security Measures in CI/CD

| Tool / Practice                | Purpose                                    | Frequency        |
| ------------------------------ | ------------------------------------------ | ---------------- |
| **CodeQL** (GitHub Advanced Security) | SAST – detects injection, XSS, crypto flaws | On every push    |
| **Dependabot**                 | Vulnerable dependency scanning & PRs       | Daily            |
| **Branch Protection**          | Require PR reviews, status checks, linear history | On `main` & `release/*` |
| **Secrets Scanner**            | Prevents accidental secret commits (pre‑commit hook + GitHub secret scanning) | On commit & push |
| **npm audit**                  | Finds known vulnerabilities in dependencies | In CI            |

## Vulnerability Response Process

1. **Report arrives** via email / private channel.
2. **Triage team** (maintainers) reproduces and classifies severity (Critical / High / Medium / Low) using [CVSS 4.0](https://www.first.org/cvss/v4.0/).
3. **Fix development** happens in a private fork or a temporary `security-fix` branch.
4. **Testing** – regression tests + additional security tests (e.g., NoSQL injection probes).
5. **Release** – a patch version (e.g., `1.0.1`) is published to npm (if applicable) and deployed to staging → production.
6. **Advisory** – if the vulnerability is not publicly known, we issue a GitHub Security Advisory and may request a CVE ID.
7. **Disclosure** – 2 weeks after patch availability, we publish a public post‑mortem (without revealing PoC that could harm unprepared users).

## Secure Development Lifecycle (SDLC) Reminders for Contributors

- **Before writing code** – think: “Could this input be malicious?” – design with Zod first.
- **During PR** – ensure all `any` are eliminated; run `npm run format` and `npm run build` locally.
- **Before merge** – a second maintainer reviews with a security checklist (authentication, injection, rate limiting bypass).
- **Post‑merge** – Dependabot will scan again; any new alert must be fixed in a follow‑up PR within 3 days.

## Compliance & Data Protection

Reshma‑Core is designed to help your e‑commerce business achieve compliance with:
- **PCI DSS** (if you integrate payment gateways like Razorpay – we never log PAN or CVV).
- **GDPR / CCPA** – user data can be deleted upon request (`DELETE /api/users/me`).
- **Indian Data Protection Bill** – data localisation is supported (configure DB region).

*However, final compliance responsibility lies with the deployment owner.*

## Security Contact

- **Primary email:** `mdafzal14777@gmail.com`  
- **GitHub Security Advisory:** Use the “Report a vulnerability” button on this repository.

We thank you for helping keep Reshma‑Core and its ecosystem secure. **Your efforts protect real businesses and their customers.**

---
