import { Document } from 'mongoose';

/**
 * Global Types
 */
export type ItemType = 'BANGLE' | 'APPAREL' | 'FABRIC' | 'INNERWEAR' | 'ACCESSORY';
export type MainCategory = 'Sarees' | 'Apparel' | 'Accessories' | 'Innerwear' | 'Bangles';
export type SellingUnit = 'Single Piece' | 'Meter' | 'Set' | 'Pair' | 'Dozen' | 'Pack';

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
    isFragile: boolean;  // Triggers mandatory image upload on return requests
    images: string[];    // Cloudinary URLs
    tags: string[];      // Keywords for MongoDB text search
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}