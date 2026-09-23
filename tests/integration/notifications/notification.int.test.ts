import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { Notification } from "@modules/notifications/notification.model";
import { NotificationService } from "@modules/notifications/notification.service";
import { Types } from "mongoose";

const API = "/api/v1/notifications";

/**
 * Seeds a notification directly in the DB (bypasses the fire-and-forget
 * service dispatch for deterministic test setup).
 */
async function seedNotification(
  userId: Types.ObjectId,
  overrides: {
    type?: "SYSTEM" | "ORDER" | "PROMOTION" | "SECURITY" | "RETURN";
    title?: string;
    message?: string;
    isRead?: boolean;
    link?: string;
  } = {},
) {
  return Notification.create({
    recipientId: userId,
    type: overrides.type ?? "SYSTEM",
    title: overrides.title ?? "Test Notification",
    message: overrides.message ?? "This is a test notification body.",
    isRead: overrides.isRead ?? false,
    ...(overrides.link ? { link: overrides.link } : {}),
  });
}

describe("Notification API — /api/v1/notifications", () => {
  describe("Auth enforcement", () => {
    it("GET / returns 401 without auth", async () => {
      const res = await request.get(API);
      expectError(res, 401);
    });

    it("PATCH /:id/read returns 401 without auth", async () => {
      const res = await request.patch(`${API}/000000000000000000000000/read`);
      expectError(res, 401);
    });
  });

  describe("GET /", () => {
    it("returns an empty list for a new user", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data).toEqual([]);
    });

    it("returns only the caller's notifications (IDOR protection)", async () => {
      const { user: userA, accessToken: tokenA } = await createUserWithToken();
      const { user: userB } = await createUserWithToken();

      await seedNotification(userA._id, { title: "For User A" });
      await seedNotification(userA._id, { title: "Also User A" });
      await seedNotification(userB._id, { title: "For User B" });

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${tokenA}`);

      expectSuccess(res, 200);
      expect(res.body.data).toHaveLength(2);
      const titles = res.body.data.map((n: { title: string }) => n.title);
      expect(titles).toContain("For User A");
      expect(titles).not.toContain("For User B");
    });

    it("sorts newest first", async () => {
      const { user, accessToken } = await createUserWithToken();

      await seedNotification(user._id, { title: "Oldest" });
      await new Promise((r) => setTimeout(r, 20));
      await seedNotification(user._id, { title: "Middle" });
      await new Promise((r) => setTimeout(r, 20));
      await seedNotification(user._id, { title: "Newest" });

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.map((n: { title: string }) => n.title)).toEqual([
        "Newest",
        "Middle",
        "Oldest",
      ]);
    });

    it("paginates via ?page & ?limit", async () => {
      const { user, accessToken } = await createUserWithToken();

      for (let i = 0; i < 5; i++) {
        await seedNotification(user._id, { title: `Notif ${i}` });
      }

      const res = await request
        .get(`${API}?page=1&limit=2`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data).toHaveLength(2);
    });

    it("returns notifications of every supported type (RETURN included)", async () => {
      const { user, accessToken } = await createUserWithToken();

      // Return-type notifications must persist — this is the bug the model
      // enum fix addresses.
      await seedNotification(user._id, {
        type: "RETURN",
        title: "Refund sent",
      });
      await seedNotification(user._id, {
        type: "ORDER",
        title: "Order placed",
      });
      await seedNotification(user._id, {
        type: "SECURITY",
        title: "Pwd changed",
      });
      await seedNotification(user._id, { type: "SYSTEM", title: "Welcome" });

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data).toHaveLength(4);
      const types = res.body.data.map((n: { type: string }) => n.type);
      expect(types).toContain("RETURN");
    });
  });

  describe("PATCH /:notificationId/read", () => {
    it("marks a notification as read", async () => {
      const { user, accessToken } = await createUserWithToken();
      const notif = await seedNotification(user._id, { isRead: false });

      const res = await request
        .patch(`${API}/${notif._id}/read`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.isRead).toBe(true);

      const fresh = await Notification.findById(notif._id);
      expect(fresh!.isRead).toBe(true);
    });

    it("returns 404 when the notification belongs to another user (IDOR)", async () => {
      const { user: owner } = await createUserWithToken();
      const notif = await seedNotification(owner._id);

      const { accessToken: attackerToken } = await createUserWithToken();

      const res = await request
        .patch(`${API}/${notif._id}/read`)
        .set("Authorization", `Bearer ${attackerToken}`);

      expectError(res, 404);

      // Confirm the notification was NOT modified
      const fresh = await Notification.findById(notif._id);
      expect(fresh!.isRead).toBe(false);
    });

    it("returns 404 for a non-existent notification", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(`${API}/000000000000000000000000/read`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectError(res, 404);
    });

    it("is idempotent — marking as read twice is safe", async () => {
      const { user, accessToken } = await createUserWithToken();
      const notif = await seedNotification(user._id);

      await request
        .patch(`${API}/${notif._id}/read`)
        .set("Authorization", `Bearer ${accessToken}`);

      const res = await request
        .patch(`${API}/${notif._id}/read`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.isRead).toBe(true);
    });
  });

  describe("Service dispatch — RETURN notifications persist", () => {
    it("sendReturnRequestedNotification writes a RETURN-typed row", async () => {
      const { user } = await createUserWithToken();

      await NotificationService.sendReturnRequestedNotification(
        user._id,
        user.email,
        user.firstname,
        "ORD-RETURN-TEST",
      );

      // Fire-and-forget: give the event loop a moment
      await new Promise((r) => setTimeout(r, 100));

      const saved = await Notification.findOne({
        recipientId: user._id,
        type: "RETURN",
      });
      expect(saved).not.toBeNull();
      expect(saved!.title).toBe("Return Request Received");
    });

    it("sendReturnRefundedNotification persists with amount formatting", async () => {
      const { user } = await createUserWithToken();

      await NotificationService.sendReturnRefundedNotification(
        user._id,
        user.email,
        user.firstname,
        "ORD-REFUND-TEST",
        1234.5,
        "Original Payment Method",
        "rfnd_test_123",
      );

      await new Promise((r) => setTimeout(r, 100));

      const saved = await Notification.findOne({
        recipientId: user._id,
        type: "RETURN",
        title: "Refund Processed",
      });
      expect(saved).not.toBeNull();
      expect(saved!.message).toContain("1234.50");
      expect(saved!.message).toContain("rfnd_test_123");
    });
  });
});
