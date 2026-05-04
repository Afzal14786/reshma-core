<div align="center">
  # Interaction & Review Module
  
  **The high-throughput, concurrency-safe engine powering product reviews, threaded comments, and dynamic mathematical aggregations.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Aggregation_Pipelines-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Zod](https://img.shields.io/badge/Zod-Dynamic_Validation-3068b7?style=flat)](#)
  [![Security](https://img.shields.io/badge/CodeQL-CWE--400_Mitigated-blue?style=flat)](#)
</div>

## 1. Overview
The Interaction Module (`src/modules/interactions/`) handles the complex lifecycle of user reviews, threaded replies (comments), and the helpful/unhelpful voting system. It is heavily optimized to decouple heavy write-operations (math calculations) from read-operations (catalog browsing).

**Base Route:** `/api/v1/interactions`

## 2. Schema Architecture & Design Decisions

### The Adjacency List Pattern (Threading)
To support infinite nesting (e.g., replying to a review, replying to a reply), the `Interaction` schema utilizes the **Adjacency List Pattern**. 
* The `parentId` field references the `_id` of another document in the same collection. 
* Top-level reviews have `parentId: null`. 

### Polymorphic Zod Validation
The Zod DTO uses a `superRefine` block to enforce context-aware business rules:
* If `type === 'REVIEW'`, a numeric `rating` (1-5) is strictly required.
* If `type === 'COMMENT'`, a `rating` is strictly forbidden to prevent users from manipulating the product's average score through nested threads.

## 3. Core Business Logic

### Cross-Module Trust Layer (Verified Purchases)
The system does not trust the frontend to declare a "Verified Purchase." During creation, the Service layer queries the `Orders` collection. If the user possesses an order containing the target `productId` with `orderStatus: 'DELIVERED'`, the `isVerifiedPurchase` flag is permanently locked to `true`.

### Asynchronous Aggregation Engine
Recalculating a product's average rating and 5-star distribution curve is computationally expensive.
* **Fire-and-Forget:** The aggregation pipeline is pushed to the background via `setImmediate()`. The HTTP `201 Created` response returns to the client instantly.
* **$cond Pipeline:** MongoDB's `$cond` operator is used to calculate the specific counts for 1-star, 2-star, etc., in a single, highly optimized database pass.

### Concurrency-Safe Voting
To handle race conditions where users rapidly click "Helpful" or "Unhelpful", the voting system relies on atomic MongoDB array operators (`$addToSet` and `$pull`). This guarantees users cannot vote twice, even if they bypass frontend debouncing.

## 4. Security Firewalls

* **CWE-400 (Memory Exhaustion):** The public `GET` route uses `Math.min(50, ...)` to enforce a hard ceiling on pagination, preventing malicious bots from requesting millions of reviews and crashing the Node heap.
* **CWE-117 (Log Injection):** All BSON ObjectIds are cast to safe hex strings, and error messages are stripped of `\r\n` characters before being piped to Winston.
* **Partial Unique Index:** A database-level firewall physically guarantees that a user can only leave *one* top-level review per product, preventing review-bombing. 