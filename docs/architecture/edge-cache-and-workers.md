<div align="center">
  
  # Edge Cache & Async Workers
  **Protecting the Node.js Event Loop and Shielding MongoDB from the Thundering Herd**

  [![Redis](https://img.shields.io/badge/Redis-Edge_Cache-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![BullMQ](https://img.shields.io/badge/BullMQ-Background_Workers-FF6B6B?style=flat)](#)
  [![Cloudinary](https://img.shields.io/badge/Cloudinary-Raw_Streams-3448C5?style=flat)](#)
</div>

## 1. Executive Summary
Reshma-Core is built on Node.js, which is inherently single-threaded. To scale to 10,000+ concurrent users, the architecture strictly mandates that the main event loop must never be blocked by CPU-intensive tasks (like PDF generation) or overwhelmed by read-heavy database spikes (the "Thundering Herd"). This is achieved via a Distributed Redis Cache and BullMQ Background Workers.

## 2. The Redis Edge Cache (Proxy Pattern)
To protect MongoDB from read-heavy catalog traffic, the platform utilizes an intelligent Edge Cache middleware (`cache.middleware.ts`).

### The Hijack & Cache Flow
1. **The Interception:** When a request hits a public `GET` route, the middleware generates a unique key (e.g., `reshma:cache:/api/v1/products?page=1`).
2. **The Cache Hit (~2ms):** If the key exists in Redis RAM, the response is instantly returned. Mongoose is bypassed entirely.
3. **The Cache Miss & Proxy:** If the data is missing, the middleware temporarily hijacks the Express `res.json` function. It allows the standard Mongoose controller to execute, but right before the data leaves the server, the hijacked function stores a copy in Redis with a 5-minute TTL, then sends it to the user.

### Self-Healing Cache Invalidation
If an Admin updates a product's price, waiting 5 minutes for the cache to expire is unacceptable. The `CacheManager.invalidateCachePattern()` is triggered as a **Fire-and-Forget** background promise inside the Admin Product Controller. The millisecond an Admin saves a change, the Redis catalog cache is wiped, ensuring the next public visitor fetches fresh MongoDB data.

## 3. The Asynchronous Worker Pipeline (BullMQ)
Tasks that require heavy CPU or long network waiting times are completely banned from the main Express HTTP thread.

### The Invoice Generation Engine
Generating a legal PDF invoice and uploading it to Cloudinary takes ~1500ms. If 1,000 users check out simultaneously, doing this synchronously would freeze the server for 25 minutes.
* **The Producer (`order.service.ts`):** Upon a successful checkout, the service instantly returns a `200 OK` to the user and drops the `orderId` into the `invoice-generation` Redis queue.
* **The Consumer (`invoice.worker.ts`):** A background BullMQ process picks up the payload. It queries the database, utilizes `PDFKit` to draw the invoice in memory, and utilizes `cloudinary.uploader.upload_stream` to pipe the Buffer directly to Cloudinary without touching the local disk.
* **Resilience:** The worker is configured with Exponential Backoff. If Cloudinary's API is temporarily down, the worker will automatically retry 3 times (waiting 5s, 25s, and 125s) before marking the job as failed.