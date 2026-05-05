<div align="center">
  # Search & Discovery Module
  **The high-performance, sub-50ms RAM-based discovery engine powering typo-tolerant and faceted searches.**

  [![Typesense](https://img.shields.io/badge/Typesense-RAM_Cluster-000000?style=flat&logo=typesense&logoColor=white)](#)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Dual_Database-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict_SDK-3178C6?style=flat)](#)
</div>

## 1. Executive Summary & Architecture
The Search Module (`src/modules/search/`) implements a **Dual-Database Architecture**. 
While MongoDB acts as the primary source of truth for ACID transactions and financial records, it is too slow for complex, typo-tolerant text searches. To solve this, we integrated **Typesense**, a C++ based, purely in-memory (RAM) search engine.

**Base Route:** `/api/v1/search`

## 2. Eventual Consistency Synchronization
To keep Typesense perfectly aligned with MongoDB without slowing down administrative CRUD operations, we implemented an **Eventual Consistency Pipeline** inside the `ProductService`.

*   **Fire-and-Forget Hooks:** When an Admin creates, updates, or deletes a product, a secondary asynchronous hook (`syncToSearchEngine`) fires.
*   **Fail-Safe Isolation:** If the Typesense cluster drops the packet, the error is logged for Datadog telemetry, but the MongoDB transaction *still succeeds*. This guarantees the Admin never sees a false-negative `500 Internal Server Error` when saving a product.
*   **Data Stripping:** The payload is mapped strictly to `ITypesenseProductPayload`, stripping out heavy non-searchable BSON data (like deeply nested variant objects) and setting `index: false` on images to preserve RAM.

## 3. Strict SDK Typings & Generic Alignment
To satisfy `exactOptionalPropertyTypes: true` in our `tsconfig.json`, the service bypasses the Typesense SDK's generic `object` defaults. 
We explicitly pass a strict `ITypesenseProductDoc` interface into the `collections<T>()` generic. This prevents "Type Confusion" alerts in CodeQL and physically prevents `undefined` properties from crashing the AST parser during filter assignments.

## 4. Query Payload Firewall (Zod)
The `SearchQuerySchema` acts as a strict gateway to the RAM cluster:
1.  **Type Coercion:** URL queries arrive as strings. Zod safely uses `z.coerce.number()` to convert `page`, `limit`, and price filters.
2.  **Memory Exhaustion Defense:** The `limit` is hard-capped at `max(100)`. If a malicious bot requests `limit=999999`, Zod blocks it before it hits the Typesense C++ engine.
3.  **Default Wildcards:** If no query is provided (`q=`), it defaults to `*`, returning the standard catalog.

## 5. Security & Rate Limiting
Because Typesense operates in RAM, it is vulnerable to scraping and high-frequency DoS attacks.
The `GET /` route is wrapped in the `standardLimiter` to throttle IP addresses, ensuring constant availability for genuine user discovery.