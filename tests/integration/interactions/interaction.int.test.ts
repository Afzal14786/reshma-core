import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { createDeliveredOrder } from "@tests/helpers/order.helper";
import { Interaction } from "@modules/interactions/interaction.model";
import { Product } from "@modules/products/models";
import { InteractionType } from "@modules/interactions/interfaces/interaction.interface";
import { Types } from "mongoose";

const API = "/api/v1/interactions";

/**
 * Waits for the async rating-sync (fired via setImmediate) to update
 * the product's ratingsMetadata. Polls up to `timeoutMs` before giving up.
 */
async function waitForRatingSync(productId: string, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = await Product.findById(productId);
    if (p?.ratingsMetadata?.totalReviews === 1) return p;
    await new Promise((r) => setTimeout(r, 50));
  }
  return Product.findById(productId);
}

describe("Interaction API — /api/v1/interactions", () => {
  describe("GET /product/:productId", () => {
    it("returns an empty list for a product with no reviews", async () => {
      const product = await createTestBangle();

      const res = await request.get(`${API}/product/${product._id}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.reviews).toEqual([]);
      expect(res.body.pagination.totalResults).toBe(0);
    });

    it("rejects an invalid productId with 400", async () => {
      const res = await request.get(`${API}/product/not-an-objectid`);
      expect(res.status).toBe(400);
    });

    it("paginates results via ?page & ?limit", async () => {
      const product = await createTestBangle();
      // Seed 3 reviews directly (bypassing the DELIVERED-order requirement)
      for (let i = 0; i < 3; i++) {
        const { user } = await createUserWithToken();
        await Interaction.create({
          productId: product._id,
          userId: user._id,
          type: InteractionType.REVIEW,
          rating: 5,
          content: `Review ${i}`,
          parentId: null,
          isVerifiedPurchase: true,
        });
      }

      const res = await request.get(
        `${API}/product/${product._id}?page=1&limit=2`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(2);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it("excludes threaded comments — only top-level REVIEWS are returned", async () => {
      const product = await createTestBangle();
      const { user } = await createUserWithToken();

      const review = await Interaction.create({
        productId: product._id,
        userId: user._id,
        type: InteractionType.REVIEW,
        rating: 4,
        content: "Parent review",
        parentId: null,
      });

      // Comment on the review
      await Interaction.create({
        productId: product._id,
        userId: user._id,
        type: InteractionType.COMMENT,
        content: "A comment on the review",
        parentId: review._id,
      });

      const res = await request.get(`${API}/product/${product._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(1);
      expect(res.body.data.reviews[0].type).toBe(InteractionType.REVIEW);
    });

    it("renders reviews from deleted users as Anonymous", async () => {
      const product = await createTestBangle();
      const { user } = await createUserWithToken();

      await Interaction.create({
        productId: product._id,
        userId: user._id,
        type: InteractionType.REVIEW,
        rating: 5,
        content: "Will be anon",
        parentId: null,
      });

      // Physically delete the user — populate will return null
      const { User } = await import("@modules/users/user.model");
      await User.deleteOne({ _id: user._id });

      const res = await request.get(`${API}/product/${product._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toHaveLength(1);
      expect(res.body.data.reviews[0].userId._id).toBe("anonymous_user");
      expect(res.body.data.reviews[0].userId.firstname).toBe("Anonymous");
    });
  });

  describe("POST / — create review", () => {
    it("creates a review for a user with a DELIVERED order (verified purchase)", async () => {
      const { accessToken } = await createUserWithToken();
      const { product } = await createDeliveredOrder({
        accessToken,
        paymentMethod: "COD",
      });

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 5,
          title: "Excellent",
          content: "Absolutely loved this product!",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.interaction.rating).toBe(5);
      expect(res.body.data.interaction.isVerifiedPurchase).toBe(true);
    });

    it("rejects a review without a DELIVERED order (403)", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 5,
          content: "Never bought this",
        });

      expect(res.status).toBe(403);
    });

    it("rejects a second review from the same user (409)", async () => {
      const { accessToken } = await createUserWithToken();
      const { product } = await createDeliveredOrder({
        accessToken,
        paymentMethod: "COD",
      });

      await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 4,
          content: "First review",
        });

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 5,
          content: "Second review",
        });

      expect(res.status).toBe(409);
    });

    it("rejects a review without a rating (400)", async () => {
      const { accessToken } = await createUserWithToken();
      const { product } = await createDeliveredOrder({
        accessToken,
        paymentMethod: "COD",
      });

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          content: "No rating here",
        });

      expect(res.status).toBe(400);
    });

    it("rejects a review with a parentId (400)", async () => {
      const { accessToken } = await createUserWithToken();
      const { product } = await createDeliveredOrder({
        accessToken,
        paymentMethod: "COD",
      });

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 5,
          content: "Should not have a parent",
          parentId: "000000000000000000000000",
        });

      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await request.post(API).send({
        productId: "000000000000000000000000",
        type: "REVIEW",
        rating: 5,
        content: "No auth",
      });
      expect(res.status).toBe(401);
    });

    it("asynchronously syncs the rating to the product document", async () => {
      const { accessToken } = await createUserWithToken();
      const { product } = await createDeliveredOrder({
        accessToken,
        paymentMethod: "COD",
      });

      await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "REVIEW",
          rating: 5,
          content: "Rating sync test",
        });

      const synced = await waitForRatingSync(String(product._id));

      expect(synced?.ratingsMetadata?.totalReviews).toBe(1);
      expect(synced?.ratingsMetadata?.averageRating).toBe(5);
      expect(synced?.ratingsMetadata?.ratingDistribution["5"]).toBe(1);
    });
  });

  describe("POST / — create comment", () => {
    async function seedReview(
      productId: Types.ObjectId,
      userId: Types.ObjectId,
    ) {
      return Interaction.create({
        productId,
        userId,
        type: InteractionType.REVIEW,
        rating: 4,
        content: "Parent review",
        parentId: null,
      });
    }

    it("creates a threaded comment on a review", async () => {
      const { user: author, accessToken: authorToken } =
        await createUserWithToken();
      const product = await createTestBangle();
      const review = await seedReview(
        product._id as Types.ObjectId,
        author._id as Types.ObjectId,
      );

      const { accessToken: commenterToken } = await createUserWithToken();

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${commenterToken}`)
        .send({
          productId: String(product._id),
          type: "COMMENT",
          content: "Great point, thanks!",
          parentId: String(review._id),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.interaction.type).toBe(InteractionType.COMMENT);
      expect(res.body.data.interaction.parentId).toBe(String(review._id));
      // Comments do not go through verified purchase check
      expect(res.body.data.interaction.isVerifiedPurchase).toBe(false);
    });

    it("rejects a comment without a parentId (400)", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "COMMENT",
          content: "Orphan comment",
        });

      expect(res.status).toBe(400);
    });

    it("rejects a comment carrying a rating (400)", async () => {
      const { user: author } = await createUserWithToken();
      const product = await createTestBangle();
      const review = await seedReview(
        product._id as Types.ObjectId,
        author._id as Types.ObjectId,
      );

      const { accessToken } = await createUserWithToken();

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "COMMENT",
          content: "Sneaky rating",
          rating: 5,
          parentId: String(review._id),
        });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the parent interaction does not exist", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productId: String(product._id),
          type: "COMMENT",
          content: "Replying to nothing",
          parentId: "000000000000000000000000",
        });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /:interactionId/vote", () => {
    async function seedInteraction(userId: Types.ObjectId) {
      const product = await createTestBangle();
      return Interaction.create({
        productId: product._id,
        userId,
        type: InteractionType.REVIEW,
        rating: 5,
        content: "Votable review",
        parentId: null,
      });
    }

    it("registers a LIKE", async () => {
      const { user: author } = await createUserWithToken();
      const review = await seedInteraction(author._id as Types.ObjectId);
      const { accessToken: voter } = await createUserWithToken();

      const res = await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${voter}`)
        .send({ action: "LIKE" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const fresh = await Interaction.findById(review._id);
      expect(fresh!.likes).toHaveLength(1);
      expect(fresh!.dislikes).toHaveLength(0);
    });

    it("switching to DISLIKE removes the prior LIKE (mutual exclusion)", async () => {
      const { user: author } = await createUserWithToken();
      const review = await seedInteraction(author._id as Types.ObjectId);
      const { accessToken: voter } = await createUserWithToken();

      await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${voter}`)
        .send({ action: "LIKE" });

      await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${voter}`)
        .send({ action: "DISLIKE" });

      const fresh = await Interaction.findById(review._id);
      expect(fresh!.likes).toHaveLength(0);
      expect(fresh!.dislikes).toHaveLength(1);
    });

    it("LIKE-ing twice is idempotent ($addToSet)", async () => {
      const { user: author } = await createUserWithToken();
      const review = await seedInteraction(author._id as Types.ObjectId);
      const { accessToken: voter } = await createUserWithToken();

      await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${voter}`)
        .send({ action: "LIKE" });

      await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${voter}`)
        .send({ action: "LIKE" });

      const fresh = await Interaction.findById(review._id);
      expect(fresh!.likes).toHaveLength(1);
    });

    it("returns 404 for a non-existent interaction", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(`${API}/000000000000000000000000/vote`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ action: "LIKE" });

      expect(res.status).toBe(404);
    });

    it("rejects an invalid action value (400)", async () => {
      const { user: author } = await createUserWithToken();
      const review = await seedInteraction(author._id as Types.ObjectId);
      const { accessToken } = await createUserWithToken();

      const res = await request
        .patch(`${API}/${review._id}/vote`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ action: "LOVE" });

      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const { user: author } = await createUserWithToken();
      const review = await seedInteraction(author._id as Types.ObjectId);

      const res = await request
        .patch(`${API}/${review._id}/vote`)
        .send({ action: "LIKE" });

      expect(res.status).toBe(401);
    });
  });
});
