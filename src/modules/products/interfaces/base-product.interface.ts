import { Document } from "mongoose";
import { TaxProfile } from "@modules/orders/tax.utils";

/**
 * Global Types
 */
export type ItemType =
  "BANGLE" | "APPAREL" | "FABRIC" | "INNERWEAR" | "ACCESSORY";
export type MainCategory =
  "Sarees" | "Apparel" | "Accessories" | "Innerwear" | "Bangles";
export type SellingUnit =
  "Single Piece" | "Meter" | "Set" | "Pair" | "Dozen" | "Pack";

/**
 * Tracks the exact distribution of star ratings for highly optimized UI rendering
 * (e.g., building the 5-bar rating chart seen on Amazon/Flipkart).
 */
export interface IRatingsDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/**
 * Denormalized metadata summary. Prevents the need to run heavy MongoDB
 * aggregations on the Interactions collection during standard catalog browsing.
 */
export interface IRatingsMetadata {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: IRatingsDistribution;
}

/**
 * Base Product Contract
 * * ARCHITECTURE NOTE:
 * This interface represents the minimum required data for any item to exist
 * in the catalog and pass through the checkout/shipping pipeline.
 */
export interface IBaseProduct extends Document {
  itemType: ItemType;
  sku: string;
  name: string;
  mainCategory: MainCategory;
  subCategory: string;
  material: string;
  sellingUnit: SellingUnit;
  colors: string[];
  basePrice: number;
  discount: number;
  currentStock: number;
  weightGrams: number; // Required for shipping matrix calculations
  isFragile: boolean; // Triggers mandatory image upload on return requests
  images: string[]; // Cloudinary URLs
  tags: string[]; // Keywords for MongoDB text search
  /**
   * Automatically managed by the Interactions Module.
   * DO NOT update manually through standard Product controllers.
   */
  ratingsMetadata: IRatingsMetadata;
  isActive: boolean;

  // Legal Tax Requirements
  hsnCode: string;
  taxProfile: TaxProfile;
  createdAt: Date;
  updatedAt: Date;
}
