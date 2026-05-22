<div align="center">

  # Database Seeding & Mock Data
  
  **The strict-typed, realistic data factory for Reshma-Core local environments.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Mongoose](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=flat&logo=typescript&logoColor=white)](#)

</div>

---

## 1. Overview & Purpose

When a new developer clones the Reshma-Core repository or boots the Docker infrastructure, their MongoDB `products` collection is completely empty. Testing features like Typesense search, pagination, and polymorphic cart validation is impossible without a robust dataset.

The `src/db/seed.ts` script acts as a deterministic data factory. It purges the existing catalog and generates 500 hyper-realistic, strictly validated e-commerce products across all 5 Mongoose Discriminator categories (Apparel, Bangles, Fabric, Innerwear, Accessory).

---

## 2. Execution & Safety Warnings

The seeding script performs a **destructive operation** (`Product.deleteMany({})`). It is strictly intended for Local Development and Staging environments. 

### DANGER: Production Data Loss
**Never execute this script against a Production MongoDB Atlas URI.** It will permanently wipe all active catalog items, instantly breaking historical order receipts and active user carts.

### How to Execute (Local Development)
Ensure your `.env` file contains your local or Docker `MONGO_URI`, then run:
```bash
# Using the pre-configured package.json script (uses tsx to run directly)
npm run seed
```   
If successful, the terminal will output:  

⏳ Connecting to MongoDB...
✅ MongoDB Connected.
🗑️  Purging existing catalog...
✅ Catalog purged.
🏭 Generating 500 hyper-realistic products...
💾 Inserting into Database (Mongoose Discriminators Active)...
🎉 SUCCESS: 500 Enterprise-Grade Products have been seeded!  

---   

## 3. The Zero 'any' Factory Architecture  

To align with the Reshma-Core **Zero** `any` **Policy**, the seeding script is strictly typed. We do not construct arbitrary objects and force them into the database.   

Every base template must conform to the `ISeedTemplate` interface. This ensures that the generated mock data perfectly mirrors the strict validation rules of our actual Mongoose schemas.  

```typescript
interface ISeedTemplate {
  itemType: string;
  mainCategory: string;
  subCategory: string;
  material: string;
  sellingUnit: string;
  colors: string[];
  weightGrams: number;
  isFragile: boolean;
  // ... polymorphic optional fields
}
```  

---  

## 4. Realistic Data Combinatorics  

A common mistake in local development is seeding products named "Test Item 1" with blank placeholder images. When the frontend team builds the UI, they miss critical edge cases like long title wrapping or image aspect ratios.  

Our factory engine uses **Combinatorics** to solve this:   

1. **Dynamic Naming:** It combines arrays of adjectives (e.g., "Premium", "Designer") with specific styles (e.g., "Banarasi Unstitched Suit", "Oxidized Silver Kadas") to create realistic string lengths.  

2. **Contextual Image Dictionaries:** Rather than gray placeholder squares, the script pulls from mapped dictionaries of high-resolution Unsplash images. An `APPAREL` item will always render a picture of clothing, while a `BANGLE` item will always render jewelry.  

3. **Price & Stock Randomization:** Prices are randomized between ₹450 and ₹4500, and a 15% discount is randomly applied to ~25% of the catalog, allowing the frontend to test "Original Price vs Sale Price" UI components.  

---  

## 5. Polymorphic Insertion Strategy  

Because Reshma-Core utilizes Mongoose Discriminators (Single Collection Polymorphism), inserting the generated data requires specific handling.  

If we executed a bulk `Product.insertMany(allProducts)`, Mongoose would treat every item as a generic `BaseProduct` and ignore the category-specific validation rules.  

To guarantee database integrity, we execute a concurrent `Promise.all` using the specific Sub-Models. This forces Mongoose to validate the Apparel items against the Apparel schema, and the Bangle items against the Bangle schema, before committing the write to MongoDB.  

```typescript
// Mongoose strictly validates the category-specific fields during insertion
await Promise.all([
  Apparel.insertMany(apparelItems),
  Bangle.insertMany(bangleItems),
  Fabric.insertMany(fabricItems),
  Innerwear.insertMany(innerwearItems),
  Accessory.insertMany(accessoryItems),
]);
```   
