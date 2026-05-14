## Description

*Provide a clear and concise description of what this PR does and why it is needed.*  
*Example: "Fixes the cart total calculation when discounts are applied. Previously, discounts were not stacking correctly."*

## Related Issue

*Link to the issue this PR addresses (if any). Use "Closes #123" to auto-close the issue on merge.*  
*If no issue exists, briefly explain the motivation.*

## Type of Change

*Please delete options that are not relevant.*

- [ ] Bug fix (non‑breaking change that fixes an issue)
- [ ] New feature (non‑breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (no code change)
- [ ] Performance improvement
- [ ] Dependency update

## How Has This Been Tested?

*Describe the tests you ran to verify your changes. Provide instructions so we can reproduce.*

- [ ] I have tested locally using `npm run dev`
- [ ] I have tested using Docker Compose (`docker-compose up`)
- [ ] I have run `npm run build` successfully

**Test case example (if applicable):**
```bash
curl -X POST http://localhost:5000/api/v1/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"abc","quantity":2}]}'
```  

## Checklist  

Please ensure your PR meets the following requirements:  

* My code follows the **coding standards** of this project (no `any`, strict TypeScript).
* I have `formatted` my code using `npm run format`.
* I have `built` the project (`npm run build`) – no TypeScript errors.
* I have added `Zod validation` for all new input (body, query, params).
* I have `not introduced any security vulnerability` (NoSQL injection, JWT bypass, etc.).
* I have `tested` my changes in the environment described above.
* I have `updated documentation` (if applicable – e.g., README, API docs, environment variables).
* I have `added meaningful commit messages` following Conventional Commits.  

## Security & Hardening (mandatory for all PRs)  
* No raw `req.body` access – all inputs pass through Zod.
* No `console.log` – using Winston logger instead.
* No hardcoded secrets or environment variables.
* If new endpoint: rate‑limiting and authentication/authorisation are correctly applied.
* If database query: uses Mongoose parameterised methods – no string concatenation.  

## Screenshots / API Response Examples

> *If the change affects API output or error messages, please paste an example response.*
> *For visual changes (admin dashboard), attach screenshots.*

## Additional Context

> *Add any other context about the PR here – e.g., related discussions, architectural decisions.*  


---  

**By submitting this PR, you agree to our [Contributor License Agreement](../CONTRIBUTING.md) and confirm that your contribution is original.**