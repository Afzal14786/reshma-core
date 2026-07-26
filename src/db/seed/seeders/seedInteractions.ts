import { Interaction } from "@modules/interactions/interaction.model";
import {
  generateInteractions,
  generateComments,
} from "../generators/generateInteractions";

export const seedInteractions = async (): Promise<void> => {
  console.log("💬 Seeding interactions...");

  // 1. Generate and insert reviews
  const reviewData = await generateInteractions();
  if (reviewData.length === 0) {
    console.log("⚠️ No reviews generated.");
    return;
  }

  const insertedReviews = await Interaction.insertMany(reviewData, {
    ordered: false,
  });
  console.log(`✅ Inserted ${insertedReviews.length} reviews.`);

  // 2. Generate comments based on inserted reviews
  const reviewInfo = insertedReviews.map((r) => ({
    _id: r._id,
    productId: r.productId,
  }));

  const commentData = await generateComments(reviewInfo);
  if (commentData.length > 0) {
    await Interaction.insertMany(commentData, { ordered: false });
    console.log(`✅ Inserted ${commentData.length} comments.`);
  } else {
    console.log("⚠️ No comments generated.");
  }

  // 3. Log total
  const total = await Interaction.countDocuments();
  console.log(`📊 Total interactions now: ${total}`);
};
