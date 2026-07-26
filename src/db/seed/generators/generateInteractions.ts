import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { User } from "@modules/users/user.model";
import { Product } from "@modules/products/models";
import { Order } from "@modules/orders/order.model";
import { IReviewInput, ICommentInput } from "../types";
import { pickRandom, REVIEW_IMAGE_POOL } from "./base-generator";

type IInteractionInput = IReviewInput | ICommentInput;

/**
 * Generate a random rating with bias toward positive (4-5 stars)
 */
const generateRating = (): number => {
  const roll = Math.random();
  if (roll < 0.05) return 1;
  if (roll < 0.15) return 2;
  if (roll < 0.3) return 3;
  if (roll < 0.6) return 4;
  return 5;
};

/**
 * Generate a realistic review title (optional)
 */
const generateReviewTitle = (): string | undefined => {
  return Math.random() > 0.3
    ? faker.lorem.sentence({ min: 3, max: 8 })
    : undefined;
};

/**
 * Generate review content (required)
 */
const generateReviewContent = (): string => {
  return faker.lorem.paragraph({ min: 2, max: 5 });
};

/**
 * Generate random image URLs (0-2) from REVIEW_IMAGE_POOL
 */
const generateImages = (): string[] => {
  const count = faker.number.int({ min: 0, max: 2 });
  if (count === 0) return [];
  return Array.from({ length: count }, () => pickRandom(REVIEW_IMAGE_POOL));
};

/**
 * Main generator: fetches users, products, orders and builds reviews and comments.
 */
export const generateInteractions = async (): Promise<IInteractionInput[]> => {
  // ---- Fetch all users ----
  const users = await User.find().select("_id").lean();
  if (users.length === 0) {
    throw new Error("No users found. Please seed users first.");
  }

  // ---- Fetch all active products ----
  const products = await Product.find({ isActive: true }).select("_id").lean();
  if (products.length === 0) {
    throw new Error("No active products found. Please seed products first.");
  }

  // ---- Fetch delivered orders to map user-product pairs ----
  const deliveredOrders = await Order.find({
    orderStatus: "DELIVERED",
  })
    .populate("items.product", "_id")
    .lean();

  // Build a map: productId -> Set of userIds who purchased it (delivered)
  const productPurchaserMap = new Map<string, Set<string>>();
  for (const order of deliveredOrders) {
    const userId = order.user.toString();
    for (const item of order.items) {
      if (item.product) {
        const productId = (item.product as any)._id.toString();
        if (!productPurchaserMap.has(productId)) {
          productPurchaserMap.set(productId, new Set());
        }
        productPurchaserMap.get(productId)!.add(userId);
      }
    }
  }

  // ---- Prepare to generate interactions ----
  const interactions: IInteractionInput[] = [];

  // ----- 1. Generate REVIEWS -----
  for (const product of products) {
    const productId = product._id;
    const productIdStr = productId.toString();
    const purchasers = productPurchaserMap.get(productIdStr) || new Set();
    const availableUsers = users.filter((u) =>
      purchasers.has(u._id.toString()),
    );

    if (availableUsers.length === 0) continue;

    const maxReviews = Math.min(availableUsers.length, 5);
    // If only 1 purchaser, we can still create 1 review
    const reviewCount =
      maxReviews > 1
        ? faker.number.int({ min: 2, max: maxReviews })
        : maxReviews; // fallback to 1

    const shuffledUsers = faker.helpers.shuffle(availableUsers);
    const selectedUsers = shuffledUsers.slice(0, reviewCount);

    for (const user of selectedUsers) {
      const rating = generateRating();
      const title = generateReviewTitle();
      const content = generateReviewContent();
      const images = generateImages();

      // Build review object conditionally to avoid undefined properties
      const review: IReviewInput = {
        productId,
        userId: user._id,
        type: "REVIEW",
        rating,
        content,
        isVerifiedPurchase: true,
        likes: [],
        dislikes: [],
        parentId: null,
      };

      if (title) review.title = title;
      if (images.length > 0) review.images = images;

      interactions.push(review);
    }
  }

  return interactions;
};

/**
 * Generate comments for existing reviews.
 * This should be called after reviews are inserted and their _ids are known.
 */
export const generateComments = async (
  reviews: Array<{ _id: Types.ObjectId; productId: Types.ObjectId }>,
): Promise<ICommentInput[]> => {
  const users = await User.find().select("_id").lean();
  if (users.length === 0) return [];

  const comments: ICommentInput[] = [];

  for (const review of reviews) {
    if (Math.random() > 0.6) continue;

    const commentCount = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < commentCount; i++) {
      const user = pickRandom(users);
      const content = faker.lorem.sentence({ min: 5, max: 15 });

      comments.push({
        productId: review.productId,
        userId: user._id,
        type: "COMMENT",
        content,
        parentId: review._id,
        isVerifiedPurchase: false,
        likes: [],
        dislikes: [],
      });
    }
  }

  return comments;
};
