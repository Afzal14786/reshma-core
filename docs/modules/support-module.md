<div align="center">

  # Customer Support Module
  
  **The decentralized, state-driven ticketing engine powering polymorphic customer inquiries, threaded conversations, and DPDP-compliant privacy redaction.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Read_Optimized-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Cloudinary](https://img.shields.io/badge/Cloudinary-Asset_Pipeline-3448C5?style=flat&logo=cloudinary&logoColor=white)](#)
  [![BullMQ](https://img.shields.io/badge/BullMQ-Async_Alerts-FF6B6B?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Firewalls-3068b7?style=flat)](#)

</div>

---

## 1. Overview

The Customer Support Module (`src/modules/support/`) is the central communication hub bridging customers and administrators. It manages threaded conversations, supports photographic evidence via Cloudinary, and legally intertwines with the platform's DPDP/GDPR compliance engines.

**Base Route:** `/api/v1/support`

---

## 2. Architectural Design Decisions (ADRs)

### A. Threaded Conversations (Embedded vs. Referenced)
* **The Problem:** In a traditional SQL setup, messages are stored in a separate table and JOINed to the Ticket. In NoSQL, doing this requires heavy `$lookup` aggregations, slowing down read times.
* **The Decision:** We utilize an **Embedded Document Array** for messages within the `Ticket` model. 
* **The Consequence:** Fetching a ticket and its entire conversation history requires exactly *one* `O(1)` database read, massively optimizing the dashboard load times. To prevent hitting the MongoDB 16MB document limit, pagination is enforced on the dashboard level rather than the message array.

### B. Polymorphic Entity Linking
A customer might complain about an Order, a Return, or a specific Product. 
* **The Decision:** The `linkedEntity` object utilizes a polymorphic design (`entityType` and `entityId`).
* **The Firewall:** To prevent IDOR (Insecure Direct Object Reference) and dangling pointers, `SupportService.verifyLinkedEntity` dynamically cross-references the `Orders` or `Returns` collection to mathematically guarantee the customer actually owns the entity they are trying to link before the ticket is created.

---

## 3. The State Machine SLA

Tickets operate on a strict Service Level Agreement (SLA) State Machine to keep the arbitration queue clean.

1. **OPEN:** The ticket is newly created by the user.
2. **IN_PROGRESS:** Assigned to an Admin who is actively investigating.
3. **WAITING_ON_CUSTOMER:** The Admin has replied. The system automatically shifts to this state and awaits the customer's response.
4. **RESOLVED:** The issue is fixed.
5. **CLOSED:** The ticket is permanently locked.

**State Machine Lock:** If a ticket status is `CLOSED`, the service throws a `403 Forbidden` if anyone (Admin or User) attempts to push a new message to the array, forcing the creation of a new ticket.

---

## 4. Security & DPDP/GDPR Compliance

The Support Module is deeply hooked into the platform's privacy engine.

### A. The Right to be Forgotten (Anonymization)
When a user deletes their account (`UserService.deleteAccount`), the ACID transaction automatically triggers `SupportService.anonymizeUserTickets`.
* It nullifies the `user` reference.
* It iterates through the embedded messages array, locating only messages sent by the `USER`, and overwrites the text with `[Redacted via DPDP/GDPR Right to be Forgotten]`.
* It explicitly drops `attachments` to destroy photographic PII.
* **Result:** The business retains the ticket analytics and Admin replies for QA purposes, but all customer PII is irreversibly destroyed.

### B. The Right to Access (Data Portability)
When the Data Export Worker compiles a user's JSON footprint, it concurrently fetches all Support Tickets and injects them into the `activity.supportTickets` payload, satisfying data portability laws.

### C. Hardcoded Role Shifting
In the Public Controller (`support.public.controller.ts`), the `senderRole` is hardcoded to `MessageSenderRole.USER`. This makes it mathematically impossible for a malicious customer to intercept the HTTP payload and spoof an "Admin" reply to their own ticket.

---

**Standard Documentation | Reshma-Core Architecture**