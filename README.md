<div align="center">

  <img src="src/assets/reshma_bangles.jpg" alt="Reshma Bangles & Boutique Logo" width="180" />

  # 🛍️ Reshma Bangles & Boutique (API Core)
  
  **The highly scalable, polymorphic backend engine powering a pan-India B2C fashion and accessory platform.**

  [![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Mongoose](https://img.shields.io/badge/Mongoose-9.x-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

</div>

---

## About The Startup
**Reshma Bangles & Boutique** is a dedicated B2C online retail platform serving customers across India. The catalog spans highly diverse categories, ranging from fragile glass bangles sold by the dozen, to readymade apparel, and unstitched fabrics requiring custom tailoring measurements.

### Business Logic Core Highlights
* **Dynamic Checkout Math:** Automated computation of Base Price + GST % + Heavy Shipping Fees + Cash On Delivery (COD) surcharges.
* **Strict Return Arbitration:** Returns are conditionally blocked (e.g., innerwear) and explicitly require photographic proof uploaded via Cloudinary for fragile items.
* **Background Notifications:** Asynchronous queue processing for "Notify Me" alerts and order status emails.

---

## Master Planning Documents

To understand the full scope of this startup, including the Product Requirements Document (PRD), exact database mappings, and our initial 50-item inventory schema, please refer to our official planning documents:

<div align="center">

  [![Notion Hub](https://img.shields.io/badge/Notion-System_Architecture_&_PRD-000000?style=flat&logo=notion&logoColor=white)](https://diligent-salesman-3d3.notion.site/ebd/345fe41c78a880d7b716e81c153c0aed)
  [![Google Sheets](https://img.shields.io/badge/Google_Sheets-Master_Product_Catalog-34A853?style=flat&logo=googlesheets&logoColor=white)](https://docs.google.com/spreadsheets/d/1QPfN6ntKm5pgzsQ4kqr5KpQRyDPtn_zdxEk-da7S5iI/edit?usp=sharing)

</div>

*(Note: These documents are set to View-Only to protect proprietary business logic).*

## Internal Documentation Hub

Reshma-Core utilizes a strict Domain-Driven Design (DDD) architecture. We maintain comprehensive internal documentation covering API standards, security, testing, and feature modules. Click any link below to navigate directly to the respective guide:

### Architecture & System Design
* **[System Overview](./docs/architecture/system-overview.md)** - The master blueprint and folder structure of the Reshma-Core backend.
* **[Authentication & Security Architecture](./docs/architecture/auth-architecture.md)** - Deep dive into the Two-Token stateless JWT, Google OAuth, and Redis OTP flows.
* **[Database Design Strategy](./docs/architecture/database-design.md)** - Explains the Mongoose Polymorphic single-collection strategy and ADRs.
* **[Product Catalog Schema](./docs/architecture/product-catalog.md)** - Maps the physical Google Sheet inventory data to the strict database rules.
* **[Security Hardening](./docs/architecture/security-hardening.md)** - Details on rate-limiting, Zod payload firewalls, and strict XSS/CSRF prevention.  
* **[Cart & Session Sync](./docs/modules/cart-module.md)** - Documentation on the Self-Healing Cart and Guest-to-User merge logic.

### API Integration Standards (For Frontend Teams)
* **[API Design & Integration Standards](./docs/api/api-standards.md)** - Expected JSON response shapes, token handling, and base URLs.
* **[Error Codes & Handling Guide](./docs/api/error-codes.md)** - Standardized error payloads and our HTTP status code dictionary.

### Testing & Setup Runbooks
* **[Authentication Testing Runbook](./docs/api/thunder-tests/auth-runbook.md)** - Sequential manual testing steps for the Auth Epic.
* **[Product Catalog Testing Runbook](./docs/api/thunder-tests/product-runbook.md)** - Testing instructions for `multipart/form-data` uploads and polymorphic Zod payloads.
* **[Local Development Setup](./docs/setup/local-development.md)** - Step-by-step guide to booting the Node server, Redis cache, and background workers.
* **[Environment Variables](./docs/setup/environment-variables.md)** - Required `.env` configuration for fail-fast boot sequences.

---

## Comprehensive Tech Stack

| Category | Technology | Description / Purpose |
| :--- | :--- | :--- |
| **Runtime & Framework** | ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white) | Core asynchronous I/O engine and web framework. |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) | Strict type safety across the entire application. |
| **Database & ODM** | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white) ![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=flat&logo=mongoose&logoColor=white) | Polymorphic catalog scaling and dynamic cart structures. |
| **Queue & Caching** | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white) ![BullMQ](https://img.shields.io/badge/BullMQ-FF4081?style=flat) | Offloading email blasts and heavy notifications. |
| **Media Pipeline** | ![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat&logo=cloudinary&logoColor=white) ![Multer](https://img.shields.io/badge/Multer-Memory_Storage-orange?style=flat) | On-the-fly image compression and multipart/form-data handling. |
| **Security** | ![Helmet](https://img.shields.io/badge/Helmet-Security-blue?style=flat) ![RateLimit](https://img.shields.io/badge/Express_Rate_Limit-Protection-red?style=flat) | HTTP header protection and brute-force/DDoS prevention. |
| **Utilities** | ![Morgan](https://img.shields.io/badge/Morgan-HTTP_Logger-green?style=flat) ![Dotenv](https://img.shields.io/badge/Dotenv-Environment-ECD53F?style=flat) | API request logging and secure environment variable management. |

---

## System Architecture & Complete Folder Structure

**Organized by Features (Domain-Driven Design):** The codebase is split into specific, isolated features (like Users, Orders, Products) rather than lumping all controllers together. This makes the system easy to manage and scale.

**Smart Database Design for Diverse Products:**
It is impossible to use one single, rigid set of rules for 50 completely different items. A glass bangle needs a "diameter" and a "fragile" shipping warning, while a dress needs a "size" (S, M, L), and unstitched fabric needs a custom "measurement" form. 

To solve this, the system utilizes a **Polymorphic Database Strategy** (via Mongoose Discriminators). In simple words:
1. **The Shared Base:** Every item shares a common foundation (SKU, Name, Price, Images). 
2. **One Global Box:** All items are stored in one single `Products` collection. This makes global features, like the website's main Search Bar, incredibly fast.
3. **Custom Individual Rules:** Even though they live in the same collection, the database applies different, strict rules based on the category. The database will reject an order if a Saree tries to use a "Bangle Size", ensuring zero data corruption.  


```text
reshma-core/
├── .env.example
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── dependabot.yml
│   └── workflows/
│       ├── codeql.yml
│       └── format-check.yml
├── .gitignore
├── CHANGES.md
├── LICENCE
├── README.md
├── SECURITY.md
├── docs/
│   ├── api/
│   │   ├── api-standards.md
│   │   ├── error-codes.md
│   │   └── thunder-tests/
│   │       ├── auth-runbook.md
│   │       └── product-runbook.md
│   ├── architecture/
│   │   ├── auth-architecture.md
│   │   ├── database-design.md
│   │   ├── payment-integration.md
│   │   ├── product-catalog.md
│   │   ├── security-hardening.md
│   │   └── system-overview.md
│   ├── modules/
│   │   ├── auth-module.md
│   │   ├── cart-module.md
│   │   ├── notification-module.md
│   │   ├── order-module.md
│   │   ├── product-module.md
│   │   └── user-module.md
│   └── setup/
│       ├── environment-variables.md
│       └── local-development.md
├── package-lock.json
├── package.json
├── src/
│   ├── app.ts
│   ├── assets/
│   │   └── reshma_bangles.jpg
│   ├── config/
│   │   ├── cloudinary.ts
│   │   ├── db.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── razorpay.ts
│   │   └── redis.ts
│   ├── db/
│   │   └── seed.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.utils.ts
│   │   │   └── dtos/
│   │   │       ├── google.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       ├── register.dto.ts
│   │   │       └── verify-otp.dto.ts
│   │   ├── cart/
│   │   │   ├── cart.controller.ts
│   │   │   ├── cart.model.ts
│   │   │   ├── cart.route.ts
│   │   │   ├── cart.service.ts
│   │   │   ├── dtos/
│   │   │   │   └── cart.dto.ts
│   │   │   └── interfaces/
│   │   │       └── cart.interface.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── dtos/
│   │   │   │   └── date-range.dto.ts
│   │   │   └── interface/
│   │   │       └── dashboard.interface.ts
│   │   ├── interactions/
│   │   │   ├── dtos/
│   │   │   │   └── add-review.dto.ts
│   │   │   ├── interaction.controller.ts
│   │   │   ├── interaction.model.ts
│   │   │   ├── interaction.routes.ts
│   │   │   ├── interaction.service.ts
│   │   │   └── interface/
│   │   │       └── review.interface.ts
│   │   ├── notifications/
│   │   │   ├── interface/
│   │   │   │   ├── email.interface.ts
│   │   │   │   └── notification.interface.ts
│   │   │   ├── notification.controller.ts
│   │   │   ├── notification.model.ts
│   │   │   ├── notification.routes.ts
│   │   │   ├── notification.service.ts
│   │   │   └── templates/
│   │   │       ├── layout.ts
│   │   │       ├── order-cancle.ts
│   │   │       ├── order-placed.ts
│   │   │       ├── otp-verification.ts
│   │   │       ├── password-reset.ts
│   │   │       ├── password-update.ts
│   │   │       └── welcome.ts
│   │   ├── orders/
│   │   │   ├── dtos/
│   │   │   │   └── order.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── order.interface.ts
│   │   │   ├── invoice.generator.ts
│   │   │   ├── order.admin.controller.ts
│   │   │   ├── order.model.ts
│   │   │   ├── order.public.controller.ts
│   │   │   ├── order.routes.ts
│   │   │   ├── order.service.ts
│   │   │   └── payment.utils.ts
│   │   ├── products/
│   │   │   ├── controllers/
│   │   │   │   ├── product.admin.controller.ts
│   │   │   │   └── product.public.controller.ts
│   │   │   ├── dtos/
│   │   │   │   ├── product.admin.dto.ts
│   │   │   │   └── product.public.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── accessory.interface.ts
│   │   │   │   ├── apparel.interface.ts
│   │   │   │   ├── bangle.interface.ts
│   │   │   │   ├── base-product.interface.ts
│   │   │   │   ├── fabric.interface.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── innerwear.interface.ts
│   │   │   ├── models/
│   │   │   │   ├── accessory.model.ts
│   │   │   │   ├── apparel.model.ts
│   │   │   │   ├── bangle.model.ts
│   │   │   │   ├── base-product.model.ts
│   │   │   │   ├── fabric.model.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── innerwear.model.ts
│   │   │   ├── product.routes.ts
│   │   │   └── product.service.ts
│   │   ├── returns/
│   │   │   ├── return.controller.ts
│   │   │   ├── return.route.ts
│   │   │   └── return.service.ts
│   │   └── users/
│   │       ├── dtos/
│   │       │   ├── add-address.dto.ts
│   │       │   └── update-profile.dto.ts
│   │       ├── interface/
│   │       │   └── user.interface.ts
│   │       ├── user.controller.ts
│   │       ├── user.model.ts
│   │       ├── user.routes.ts
│   │       └── user.service.ts
│   ├── routes/
│   │   └── index.ts
│   ├── server.ts
│   └── shared/
│       ├── constant/
│       │   └── http-codes.ts
│       ├── infrastructure/
│       │   └── mailer.ts
│       ├── middlewares/
│       │   ├── auth.middleware.ts
│       │   ├── error.middleware.ts
│       │   ├── http-logger.ts
│       │   ├── rate-limit.middleware.ts
│       │   ├── role.middleware.ts
│       │   ├── upload.middleware.ts
│       │   └── validate.middleware.ts
│       ├── queues/
│       │   ├── email.queue.ts
│       │   └── email.worker.ts
│       ├── types/
│       │   └── express.d.ts
│       └── utils/
│           ├── api-response.ts
│           └── app-error.ts
└── tsconfig.json
```


## Getting Started (Developer Setup)

**1. Installation** 
```bash
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core
npm install
``` 

**2. Environment Configuration**   
Duplicate the example environment file and fill in your credentials.

```bash
cp .env.example .env
```

**3. Run the Development Server**  
The development server utilizes `nodemon`, `ts-node`, and `tsconfig-paths` for hot-reloading with path aliases.

```bash
npm run dev
```  

---
<div align="center">
👨‍💻 Meet the Developer  
</div> 

<div align="center">

  **"Building robust, strictly-typed systems that scale gracefully."**

  I am **Md Afzal Ansari**, a Software Developer specializing in the MERN stack and C++ systems programming. I am passionate about crafting highly scalable backend architectures, engineering microservices, and solving complex problems with clean, efficient Data Structures and Algorithms. Whether I am architecting e-commerce backends or building systems tools from scratch, I prioritize performance, type safety, and domain-driven design.

  Currently based in India and actively developing production-grade applications.

  ### Let's Connect! 

  [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/0x4f5a4c/)
  [![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/Afzal14786)
  [![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=flat&logo=instagram&logoColor=white)](https://instagram.com/iamafzal.ansari)
  [![Portfolio](https://img.shields.io/badge/Portfolio-2563EB?style=flat&logo=globe&logoColor=white)](https://iamafzal-dev.verce.app)
  [![Email](https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white)](mailto:mdafzal14777@gmail.com)

</div>  

--- 

<div align="center">

  ⭐ *If you found this architecture or codebase helpful, please consider giving it a star on GitHub!* ⭐

  <br>

  `Built with ❤️ and strict TypeScript by Md Afzal Ansari`

</div>