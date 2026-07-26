import { Notification } from "@modules/notifications/notification.model";
import { generateNotifications } from "../generators/generateNotifications";

/**
 * Seed notifications.
 */
export const seedNotifications = async (): Promise<void> => {
  console.log("🔔 Seeding notifications...");

  const notifications = await generateNotifications();

  if (notifications.length === 0) {
    console.log("⚠️ No notifications generated.");
    return;
  }

  // Insert notifications with ordered: false to continue on duplicates (if any)
  const inserted = await Notification.insertMany(notifications, {
    ordered: false,
  });
  console.log(`✅ Inserted ${inserted.length} notifications.`);

  // Log total
  const total = await Notification.countDocuments();
  console.log(`📊 Total notifications now: ${total}`);
};
