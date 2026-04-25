# Security Policy

## Overview
Security is a top priority for Reshma-Core. As a polymorphic e-commerce engine handling transactions and user data, we are committed to maintaining a secure environment. We leverage automated SAST (CodeQL), supply chain monitoring (Dependabot), and strict branch protection to minimize risks.

## Supported Versions
We provide security updates for the current major release and the immediate previous version.

| Version | Supported          | Status             |
| ------- | ------------------ | ------------------ |
| 5.0.x   | :white_check_mark: | Active Development |
| 4.0.x   | :white_check_mark: | Maintenance        |
| < 4.0   | :x:                | End of Life (EOL)  |

## Reporting a Vulnerability
**Do not open a public GitHub issue for security vulnerabilities.** Publicly disclosing a vulnerability could put our users and payment integrations at risk.

If you discover a security-related bug (e.g., NoSQL injection, JWT bypass, or payment logic flaw), please follow these steps:

1. **Private Report:** Send a detailed email to `mdafzal14777@gmail.com` or use the GitHub [Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-adhering-to-vulnerabilities/privately-reporting-a-security-vulnerability) feature if enabled on this repo.
2. **Details Requested:** Include a description of the vulnerability, a proof-of-concept (PoC), and the potential impact.
3. **Response Timeline:** You will receive an acknowledgment within 48 hours. We aim to provide a fix or a mitigation plan within 7–10 business days.

## Security Hardening Standards
Every contribution to Reshma-Core must adhere to our existing security architecture:
* **Payload Validation:** All inputs must pass Zod DTO firewalls.
* **Auth Standards:** Use the established stateless JWT and role-based access control (RBAC).
* **Data Sanitization:** Avoid the use of the `any` keyword and maintain strict TypeScript typing to prevent logical overflows.
* **Environment Security:** Never commit `.env` files; use the provided `.env.example` for local setup.