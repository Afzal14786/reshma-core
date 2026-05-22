<div align="center">

  # Interactions Module
  
  **The community engagement engine – product reviews, threaded comments, and helpfulness voting.**

  [![Reviews](https://img.shields.io/badge/Reviews-Product_Feedback-47A248?style=flat)](#)
  [![Threaded](https://img.shields.io/badge/Comments-Threaded_Conversations-FF6B6B?style=flat)](#)
  [![Voting](https://img.shields.io/badge/Voting-Upvote_/_Downvote-3448C5?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /product/:productId](#get-productproductid)
  - [POST /](#post-)
  - [PATCH /:interactionId/vote](#patch-interactionidvote)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  : `/api/v1/interactions`  


Public endpoints (`GET /product/:productId`) are open to all. Write endpoints (`POST /`, `PATCH /.../vote`) require a valid access token (authenticated user).

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/product/:productId` | Public | Fetch paginated top‑level reviews for a product (includes nested comments) |
| `POST` | `/` | Private (Bearer) | Create a new review or a threaded comment |
| `PATCH` | `/:interactionId/vote` | Private (Bearer) | Upvote or downvote an existing interaction |

> Rate limits: `standardLimiter` applies (100 requests per 15 minutes per IP). Public endpoint also uses `standardLimiter`.

---

## Endpoint Details

### `GET /product/:productId`

Fetch all reviews (top‑level) for a specific product, with their nested comments. Paginated to prevent large payloads.

**Headers:** None required.

**URL Parameter:** `productId` – valid MongoDB ObjectId of the product.

**Query parameters:**

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | `1` | – | Page number (1‑based) |
| `limit` | integer | `10` | `50` | Items per page (capped at 50) |

**Example request:**

```text
GET /api/v1/interactions/product/64a7b...?page=1&limit=10
```  


**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Product interactions retrieved successfully",
  "data": {
    "interactions": [
      {
        "_id": "...",
        "type": "REVIEW",
        "productId": "64a7b...",
        "userId": { "_id": "...", "firstname": "John", "avatar": "..." },
        "rating": 5,
        "content": "Absolutely love this product!",
        "voteCount": 12,
        "createdAt": "2026-05-20T10:00:00.000Z",
        "comments": [
          {
            "_id": "...",
            "type": "COMMENT",
            "parentId": "...",
            "userId": { "_id": "...", "firstname": "Admin", "avatar": "..." },
            "content": "Thank you for your review!",
            "createdAt": "2026-05-21T12:00:00.000Z"
          }
        ]
      }
    ],
    "meta": {
      "total": 25,
      "limit": 10,
      "page": 1
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

> Only top‑level interactions (`type: "REVIEW"`) are returned. Comments are nested under their parent review.  

### `POST /`  

Create a new interaction – either a review (top‑level) or a **comment** (reply to an existing review).  

**Headers:** `Authorization: Bearer <access_token>`  

**Request body for a REVIEW:**  

```json
{
  "productId": "64a7b...",
  "type": "REVIEW",
  "rating": 5,
  "content": "Amazing quality, fast shipping!"
}
```  

**Response (201 Created):**  

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Interaction created successfully",
  "data": {
    "_id": "...",
    "type": "REVIEW",
    "productId": "64a7b...",
    "userId": "...",
    "rating": 5,
    "content": "Amazing quality, fast shipping!",
    "voteCount": 0,
    "createdAt": "2026-05-22T10:35:00.000Z"
  },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  

**Business rules:**  

- A user can submit only one **review per product** (duplicate reviews return `409 Conflict`).
- Comments can be nested arbitrarily (threaded).
- `rating` is only allowed for `type: "REVIEW"` – if provided in a `COMMENT`, it is rejected.  

### `PATCH /:interactionId/vote`

Upvote or downvote an interaction (review or comment). A user can vote only once per interaction; subsequent votes toggle (remove vote if same action, change if different).

**Headers:**  
`Authorization: Bearer <access_token>`

**URL Parameter:**  
- `interactionId` – ID of the review or comment.  

**Request body:**  
```json
{
  "action": "LIKE"   // or "DISLIKE"
}
```  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Vote recorded successfully",
  "data": {
    "interactionId": "...",
    "voteCount": 13,
    "userVote": "LIKE"   // null if removed
  },
  "timestamp": "2026-05-22T10:40:00.000Z"
}
```  

**Vote logic:**  

- If user has not voted → adds vote, increments `voteCount`.
- If user has voted with same action → removes vote, decrements `voteCount`.
- If user has voted with opposite action → changes vote, `voteCount` unchanged (e.g., +1 then -1).  

---  

## Validation Rules (Zod)

| Endpoint | Field | Rules |
|----------|-------|-------|
| `POST /` (REVIEW) | `productId` | valid ObjectId, required |
| | `type` | must be `"REVIEW"`, required |
| | `rating` | integer 1‑5, required |
| | `content` | string, 3‑2000 chars, required |
| `POST /` (COMMENT) | `productId` | valid ObjectId, required |
| | `type` | must be `"COMMENT"`, required |
| | `parentId` | valid ObjectId (must exist as a review), required |
| | `content` | string, 3‑2000 chars, required |
| `PATCH /:interactionId/vote` | `action` | enum `["LIKE", "DISLIKE"]`, required |

> All schemas use `.strict()` – extra fields are rejected. The `rating` field is forbidden in COMMENT requests (Zod refinement).  

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Rating is forbidden on threaded COMMENTS"` | Comment includes rating field |
| 400 | `BAD_REQUEST` | `"Parent interaction must be a REVIEW"` | Comment references another comment |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing/invalid token for write endpoints |
| 404 | `NOT_FOUND` | `"Product not found"` | Invalid productId |
| 404 | `NOT_FOUND` | `"Parent interaction not found"` | Invalid parentId for comment |
| 409 | `CONFLICT` | `"You have already submitted a review for this product"` | Duplicate review |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |  

---

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/interaction-runbook.md`. The runbook covers:

- Creating a product review with rating
- Replying to a review with a comment
- Upvoting and downvoting
- Fetching paginated reviews for a product
- Edge cases: duplicate review, rating on comment, invalid parent  

---   

## Related Documentation

- [Products Module](./products.md) – product catalog for interaction references.
- [Users Module](./users.md) – user profiles for review authors.
- [Error Handling Guide](../error-codes.md) – status codes.
- [Authentication Guide](../authentication.md) – token requirements.  

---  

<div align="center">

Authentic feedback, community driven – the Reshma‑Core interaction engine.
</div>