import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { User } from "@modules/users/user.model";
import { Order } from "@modules/orders/order.model";
import { Product } from "@modules/products/models";
import { ReturnModel } from "@modules/returns/return.model";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  LinkedEntityType,
  MessageSenderRole,
} from "@modules/support/interfaces/support.interface";
import { pickRandom, ALL_PRODUCT_IMAGES } from "./base-generator";
import {
  ITicketMessageInput,
  ILinkedEntityInput,
  ITicketInput,
} from "../types";

/**
 * Generate a realistic support ticket subject
 */
const generateSubject = (category: TicketCategory): string => {
  const prefixes = {
    [TicketCategory.ORDER_ISSUE]: [
      "Problem with order",
      "Order issue",
      "Wrong item in order",
      "Order not delivered",
    ],
    [TicketCategory.PAYMENT_ISSUE]: [
      "Payment failed",
      "Payment discrepancy",
      "Refund not received",
      "Billing error",
    ],
    [TicketCategory.RETURN_ISSUE]: [
      "Return not accepted",
      "Return pickup issue",
      "Return refund delay",
    ],
    [TicketCategory.PRODUCT_INQUIRY]: [
      "Product question",
      "Product quality issue",
      "Product damaged",
    ],
    [TicketCategory.TECHNICAL_ISSUE]: [
      "Website error",
      "App issue",
      "Login problem",
    ],
    [TicketCategory.GENERAL]: ["General inquiry", "Help needed", "Suggestion"],
  };
  const prefixList = prefixes[category] || ["Support request"];
  const prefix = pickRandom(prefixList);
  const suffix = faker.lorem.words({ min: 2, max: 5 });
  return `${prefix}: ${suffix}`;
};

/**
 * Generate a realistic support message
 */
const generateMessage = (role: MessageSenderRole): string => {
  if (role === MessageSenderRole.USER) {
    return faker.lorem.paragraph({ min: 2, max: 4 });
  } else {
    return (
      faker.lorem.paragraph({ min: 1, max: 3 }) +
      " Please let us know if you need further assistance."
    );
  }
};

/**
 * Generate random attachments (0-2 mock Cloudinary URLs)
 */
const generateAttachments = (): string[] => {
  const count = faker.number.int({ min: 0, max: 2 });
  if (count === 0) return [];
  return Array.from({ length: count }, () => pickRandom(ALL_PRODUCT_IMAGES));
};

/**
 * Main generator: fetches users, orders, products, returns and builds support tickets.
 */
export const generateSupportTickets = async (
  ticketCount: number = 30,
): Promise<ITicketInput[]> => {
  const tickets: ITicketInput[] = [];

  // ---- Fetch all users ----
  const users = await User.find().select("_id").lean();
  if (users.length === 0) {
    throw new Error("No users found. Please seed users first.");
  }

  // Guarantee that users[0] exists for admin references
  const adminUser = users[0];
  if (!adminUser) {
    throw new Error("Admin user not found.");
  }

  // ---- Fetch orders (for linking) ----
  const orders = await Order.find().select("_id").lean();
  // ---- Fetch products (for linking) ----
  const products = await Product.find({ isActive: true }).select("_id").lean();
  // ---- Fetch returns (for linking) ----
  const returns = await ReturnModel.find().select("_id").lean();

  // Pre-compute possible linked entity options
  const linkableEntities: { type: LinkedEntityType; id: Types.ObjectId }[] = [];
  orders.forEach((o) =>
    linkableEntities.push({ type: LinkedEntityType.ORDER, id: o._id }),
  );
  products.forEach((p) =>
    linkableEntities.push({ type: LinkedEntityType.PRODUCT, id: p._id }),
  );
  returns.forEach((r) =>
    linkableEntities.push({ type: LinkedEntityType.RETURN, id: r._id }),
  );

  for (let i = 0; i < ticketCount; i++) {
    // ---- Pick a random user ----
    const user = pickRandom(users);

    // ---- Generate category and subject ----
    const category = pickRandom(Object.values(TicketCategory));
    const subject = generateSubject(category);

    // ---- Determine status (weighted) ----
    const statusRoll = Math.random();
    let status: TicketStatus;
    if (statusRoll < 0.25) status = TicketStatus.OPEN;
    else if (statusRoll < 0.45) status = TicketStatus.IN_PROGRESS;
    else if (statusRoll < 0.65) status = TicketStatus.WAITING_ON_CUSTOMER;
    else if (statusRoll < 0.85) status = TicketStatus.RESOLVED;
    else status = TicketStatus.CLOSED;

    // ---- Determine priority ----
    const priorityRoll = Math.random();
    let priority: TicketPriority;
    if (priorityRoll < 0.1) priority = TicketPriority.CRITICAL;
    else if (priorityRoll < 0.3) priority = TicketPriority.HIGH;
    else if (priorityRoll < 0.7) priority = TicketPriority.MEDIUM;
    else priority = TicketPriority.LOW;

    // ---- Determine if ticket has a linked entity (40% chance) ----
    let linkedEntity: ILinkedEntityInput | undefined;
    if (linkableEntities.length > 0 && Math.random() < 0.4) {
      const entity = pickRandom(linkableEntities);
      linkedEntity = {
        entityType: entity.type,
        entityId: entity.id,
      };
    }

    // ---- Generate messages (2-4 messages) ----
    const messageCount = faker.number.int({ min: 2, max: 4 });
    const messages: ITicketMessageInput[] = [];

    // First message is always from USER
    messages.push({
      senderRole: MessageSenderRole.USER,
      senderId: user._id,
      message: generateMessage(MessageSenderRole.USER),
      attachments: generateAttachments(),
      isRead: true,
    });

    // Subsequent messages alternate: USER -> ADMIN -> USER -> ADMIN...
    for (let j = 1; j < messageCount; j++) {
      const role =
        j % 2 === 1 ? MessageSenderRole.ADMIN : MessageSenderRole.USER;
      const senderId =
        role === MessageSenderRole.ADMIN ? adminUser._id : user._id;
      messages.push({
        senderRole: role,
        senderId,
        message: generateMessage(role),
        attachments: generateAttachments(),
        isRead: role === MessageSenderRole.USER ? true : false,
      });
    }

    // ---- Build the ticket object ----
    const ticket: ITicketInput = {
      user: user._id,
      subject,
      category,
      priority,
      status,
      messages,
    };

    if (linkedEntity) ticket.linkedEntity = linkedEntity;

    // ---- Optionally assign an admin (if status is IN_PROGRESS, RESOLVED, or WAITING_ON_CUSTOMER) ----
    if (
      status === TicketStatus.IN_PROGRESS ||
      status === TicketStatus.RESOLVED ||
      status === TicketStatus.WAITING_ON_CUSTOMER
    ) {
      ticket.assignedAdmin = adminUser._id;
    }

    tickets.push(ticket);
  }

  return tickets;
};
