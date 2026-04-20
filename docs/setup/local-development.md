<div align="center">

  <img src="../../src/assets/reshma_bangles.jpg" alt="Reshma Bangles & Boutique Logo" width="120" />

  # Local Development Setup
  
  **The definitive guide to getting the Reshma-Core backend running on your local workstation.**

  [![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Local_/_Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Redis](https://img.shields.io/badge/Redis-Storage_/_Queues-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Prerequisites

Before you begin, ensure you have the following services installed and running on your machine:

| Service | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or higher | JavaScript Runtime Engine |
| **MongoDB** | `v6.0` or higher | Primary NoSQL Database |
| **Redis** | `v7.0` or higher | Caching & BullMQ Background Jobs |
| **Package Manager** | `npm` | Dependency Management |

---

## Getting Started

### 1. Clone the Repository
Start by pulling the latest source code from GitHub to your local environment.

```bash
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core
```

### 2. Install Dependencies  
Install all required production and development packages defined in `package.json`.  

```bash
npm install
```  

### 3. Environment Configuration  
The application uses strict Zod validation for secrets. You must create a `.env` file from the provided template.  

```bash
cp .env.example .env
```  

*Note: Open the `.env` file and fill in your local MongoDB URI, Redis URL, and SMTP credentials. Refer to the [Environment Variables Guide](./environment-variables.md) for details.*

### 4. Database Seeding (Optional)  
To populate your local database with initial product categories and test data, run the seeding script:  
```bash
npm run seed
```  

### Available Scripts  

In the project directory, you can run the following commands:  
| Command         | Action                                                                                           |
|----------------|--------------------------------------------------------------------------------------------------|
| `npm run dev`  | Development: Starts the server with nodemon & ts-node (Hot-Reloading enabled).                  |
| `npm run build`| Production Build: Compiles TypeScript to JS in the `dist/` folder and resolves path aliases.    |
| `npm run start`| Execution: Runs the compiled production build from `dist/server.js`.                            |
| `npm run seed` | Data Injection: Executes the DB seeding script for initial setup.                               |  

## Troubleshooting

### 1. "Error: Cannot find module '@config/env'"

This occurs if the path aliases are not resolved.

- **Fix:** Ensure you run `npm run build` which triggers `tsc-alias` to rewrite the paths in the `dist` folder.

### 2. Redis Connection Refused

- **Fix:** Ensure your local Redis server is running (`redis-server`). BullMQ will fail to initialize without an active Redis connection.

### 3. MongoDB Auth Failed

- **Fix:** Double-check your `MONGO_URI` in the `.env` file. If using local Mongo without a password, ensure the URI is `mongodb://localhost:27017/reshma-core`.  

--- 

<div align="center">

Built with ❤️ and strict TypeScript by Md Afzal Ansari

</div>