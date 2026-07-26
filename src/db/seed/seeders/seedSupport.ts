import { Ticket } from "@modules/support/support.model";
import { generateSupportTickets } from "../generators/generateSupport";

/**
 * Seed support tickets.
 */
export const seedSupport = async (): Promise<void> => {
  console.log("🎫 Seeding support tickets...");

  const tickets = await generateSupportTickets(30);

  if (tickets.length === 0) {
    console.log("⚠️ No support tickets generated.");
    return;
  }

  const inserted = await Ticket.insertMany(tickets, { ordered: false });
  console.log(`✅ Inserted ${inserted.length} support tickets.`);

  // Log total
  const total = await Ticket.countDocuments();
  console.log(`📊 Total support tickets now: ${total}`);
};
