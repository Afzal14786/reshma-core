<div align="center">

  # Notifications Module
  
  **The in‑app alert engine – real‑time updates, order status, support replies, and data export completions.**

  [![In-App](https://img.shields.io/badge/In_App-Real_Time_Alerts-47A248?style=flat)](#)
  [![Read Receipts](https://img.shields.io/badge/Read_Receipts-Mark_as_Read-FF6B6B?style=flat)](#)
  [![IDOR](https://img.shields.io/badge/IDOR-Ownership_Checks-3448C5?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /](#get-)
  - [PATCH /:notificationId/read](#patch-notificationidread)
- [Validation & Security](#validation--security)
- [Response Structure](#response-structure)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/notifications`  


All endpoints are **private** (require a valid access token) and are rate‑limited (100 requests per 15 minutes per IP).

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Private (Bearer) | Fetch the authenticated user's in‑app notifications (paginated, newest first) |
| `PATCH` | `/:notificationId/read` | Private (Bearer) | Mark a specific notification as read (ownership enforced) |

---

## Endpoint Details

### `GET /`

Retrieve the user's in‑app notification history. Notifications are created for events such as:
- Order status updates (shipped, delivered, cancelled)
- Support ticket replies
- Data export completion
- Password change confirmation

**Headers:** `Authorization: Bearer <access_token>`

**Query parameters (optional):**

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | `1` | – | Page number (1‑based) |
| `limit` | integer | `20` | `100` | Items per page (capped at 100) |
| `unreadOnly` | boolean | `false` | – | If `true`, returns only unread notifications |

**Example request:**
```text
GET /api/v1/notifications?page=1&limit=20&unreadOnly=true
```  


**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "64a7b...",
        "type": "ORDER_STATUS",
        "title": "Order #ORD-12345 has been shipped",
        "message": "Your order has been dispatched. Tracking ID: AWB123456",
        "isRead": false,
        "metadata": {
          "orderId": "64a7c...",
          "trackingNumber": "AWB123456"
        },
        "createdAt": "2026-05-22T14:30:00.000Z"
      },
      {
        "_id": "64a7d...",
        "type": "SUPPORT_REPLY",
        "title": "New reply on ticket #TCK-9A4B2",
        "message": "Admin has replied to your support ticket.",
        "isRead": true,
        "metadata": {
          "ticketId": "TCK-9A4B2"
        },
        "createdAt": "2026-05-21T10:15:00.000Z"
      }
    ],
    "meta": {
      "total": 5,
      "unreadCount": 2,
      "limit": 20,
      "page": 1
    }
  },
  "timestamp": "2026-05-22T15:00:00.000Z"
}
```  

> Notifications are automatically created by various services (OrderService, SupportService, ExportQueueManager). The user does not create them directly.  

### `PATCH /:notificationId/read`

Mark a single notification as read. The endpoint verifies that the notification belongs to the authenticated user (IDOR protection) before updating.

**Headers:** `Authorization: Bearer <access_token>`

**URL Parameter:**  
- `notificationId` – valid MongoDB ObjectId of the notification.

**Request body:** None (empty).

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": {
    "_id": "64a7b...",
    "isRead": true,
    "readAt": "2026-05-22T15:05:00.000Z"
  },
  "timestamp": "2026-05-22T15:05:00.000Z"
}
```  

**Error cases:**  

- Notification not found → `404 Not Found`
- Notification belongs to another user → `403 Forbidden` (IDOR protection)  

---  

## Validation & Security

| Concern | Mitigation |
|---------|-------------|
| **IDOR (Insecure Direct Object Reference)** | `PATCH /:notificationId/read` checks that the notification's `userId` matches `req.user._id`. Returns `403` if mismatched. |
| **NoSQL injection** | `notificationId` is validated as a 24‑hex ObjectId via Zod in the route (implicitly or via controller). |
| **Rate limiting** | `standardLimiter` (100/15min) prevents enumeration of notification IDs. |
| **Pagination abuse** | `limit` is capped at 100. |

**Zod validation (implied – add if not present):**  
```typescript
const MarkNotificationReadSchema = z.object({
  params: z.object({
    notificationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid notification ID format"),
  }),
});
```  

---  

## Response Structure (`GET /`)

| Field | Type | Description |
|-------|------|-------------|
| `notifications[]._id` | string | Notification unique ID |
| `notifications[].type` | string | `ORDER_STATUS`, `SUPPORT_REPLY`, `EXPORT_READY`, `SECURITY_ALERT`, etc. |
| `notifications[].title` | string | Short summary |
| `notifications[].message` | string | Detailed description (safe to display) |
| `notifications[].isRead` | boolean | Read status |
| `notifications[].metadata` | object | Optional contextual data (`orderId`, `ticketId`, `fileUrl`, etc.) |
| `notifications[].createdAt` | string (ISO) | When the notification was generated |
| `meta.total` | number | Total notifications matching the query |
| `meta.unreadCount` | number | Number of unread notifications (regardless of pagination) |
| `meta.limit` | number | Requested limit |
| `meta.page` | number | Current page |

## Notification Types (Examples)

| Type | Trigger | Example title |
|------|---------|----------------|
| `ORDER_STATUS` | Order shipped, delivered, cancelled | `Order #ORD-123 has been shipped` |
| `SUPPORT_REPLY` | Admin replies to user's ticket | `New reply on ticket #TCK-9A4B2` |
| `EXPORT_READY` | Data export job completes | `Your data export is ready for download` |
| `SECURITY_ALERT` | Password change, login from new device | `Your password was changed successfully` |
| `RETURN_STATUS` | Return approved or rejected | `Return request #RET-456 has been approved` |

> The frontend can use the `type` field to show different icons or handle actions (e.g., navigate to order detail on click).  

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Invalid notification ID format"` | Invalid ObjectId in URL |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing or invalid token |
| 403 | `FORBIDDEN` | `"You do not have permission to access this notification"` | IDOR violation |
| 404 | `NOT_FOUND` | `"Notification not found"` | Notification ID does not exist |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/notification-runbook.md` (if created). The runbook covers:

- Fetching paginated notifications
- Filtering unread notifications
- Marking a notification as read
- IDOR test (trying to mark another user's notification)

---  

## Related Documentation

- [Orders Module](./orders.md) – order status notifications.
- [Support Module](./support.md) – ticket reply notifications.
- [Users Module](./users.md) – security alerts and data export notifications.
- [Authentication Guide](../authentication.md) – token requirements.
- [Error Handling Guide](../error-codes.md) – 403/404 handling.  

---  

<div align="center">

Stay informed, never miss a beat – the Reshma‑Core notification engine.
</div>  
