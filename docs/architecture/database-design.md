<div align="center">

  # Database Design & Polymorphic Catalog
  
  **The scalable NoSQL data modeling strategy for the diverse Reshma-Core inventory.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Mongoose](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](#)

</div>

---

## 1. The Polymorphic Strategy (Single Collection)

In a traditional SQL database, handling completely different item types (like Glass Bangles versus Unstitched Fabrics) requires complex JOIN tables or the Entity-Attribute-Value pattern. Both approaches severely degrade read performance as the catalog grows.

Reshma-Core utilizes **Mongoose Discriminators**, which is a Polymorphic NoSQL pattern. All products, regardless of their category, live inside one single `Products` collection. This allows global text searches, universal pagination, and unified category filtering to operate in milliseconds. 

However, at the application layer, Mongoose strictly enforces unique validation schemas based on the `itemType` discriminator key. The database will physically reject a query if an Apparel item attempts to save a Bangle-specific property.

---

## 1.1 Architecture Decision Record: Why Polymorphism?

Before settling on Mongoose Discriminators, we evaluated two other common e-commerce database patterns. Here is why we rejected them and chose our current path. This context is critical for new developers to understand why we do not split collections.

**Rejected Alternative 1: Multiple Collections**
* **The Idea:** Create a separate MongoDB collection for each category (`Apparel`, `Bangles`, `Fabrics`).
* **Why it fails:** If a customer searches the website for the color "Red", the backend would have to query all three collections simultaneously, wait for the results, and stitch the pagination together in the Node.js memory. This is incredibly slow and scales terribly as new categories are added.

**Rejected Alternative 2: The EAV Pattern (Entity-Attribute-Value)**
* **The Idea:** Maintain one `Products` collection, but use a generic array for custom fields, such as `attributes: [{ key: 'size', value: 'XL' }]`.
* **Why it fails:** We lose strict type-safety and validation. The database cannot prevent a developer or admin from accidentally inserting `{ key: 'bangleSize', value: '34C' }` into a Saree. Furthermore, indexing an array of dynamic objects for fast searching is highly inefficient in MongoDB.

**The Winning Solution: Single Collection Polymorphism**
* By using Mongoose Discriminators, all items live in one collection. This allows global `db.products.find({ tags: "Red" })` text searches to execute instantly.
* At the same time, Mongoose enforces strict, category-specific validation at the application layer, giving us the read speed of NoSQL with the data strictness of SQL.

---

## 2. Base Product Schema

This is the foundation. Every single item sold on the platform must contain these fields in order to function within the global cart and checkout system.

| Field | Type | Rules | Why this exists |
| :--- | :--- | :--- | :--- |
| `itemType` | String | Required | **The Discriminator Key.** Tells Mongoose which sub-schema rules to apply (`BANGLE`, `APPAREL`, `FABRIC`). |
| `sku` | String | Required, Unique | Stock Keeping Unit. The exact physical identifier used in the warehouse. |
| `name` | String | Required, Trimmed | The display title of the product. |
| `description` | String | Required | Rich text or markdown description for the frontend. |
| `basePrice` | Number | Required, `min: 0` | The raw price before GST or shipping calculations. |
| `discount` | Number | Default: `0`, `max: 100` | Percentage discount applied to the item. |
| `stockCount` | Number | Required, `min: 0` | Current inventory level. Critical for preventing overselling. |
| `images` | [String] | Required | Array of secure Cloudinary URLs. |
| `tags` | [String] | Indexed | Searchable keywords to power the search bar without needing external search engines. |
| `isActive` | Boolean | Default: `true` | Soft-delete flag. We never hard-delete products because it would break historical order receipts. |

---

## 3. Discriminator Sub-Schemas

These schemas inherit the Base Schema and add their own strictly validated, category-specific fields. This prevents data corruption.

### A. The Bangle Schema (`itemType: 'BANGLE'`)
* **Why it exists:** Bangles have unique sizing systems and shipping risks that apparel does not share.
| Field | Type | Rules | Why this exists |
| :--- | :--- | :--- | :--- |
| `diameter` | Enum | `['2/2', '2/4', '2/6', '2/8']` | Traditional Indian bangle sizing metrics. |
| `material` | Enum | `['GLASS', 'METAL', 'LAC']` | Material composition for filtering. |
| `isFragile` | Boolean | Required | **Critical for returns.** If true, the system forces the user to upload Cloudinary photographic proof of damage before allowing a return request. |
| `packSize` | Number | Default: `12` | Bangles are rarely sold individually, requiring dynamic unit pricing displays. |

### B. The Apparel Schema (`itemType: 'APPAREL'`)
* **Why it exists:** Readymade garments rely on standard alphabetic or numeric sizing charts.
| Field | Type | Rules | Why this exists |
| :--- | :--- | :--- | :--- |
| `size` | Enum | `['XS', 'S', 'M', 'L', 'XL', 'XXL']` | Standard readymade sizing for stock management. |
| `fabricType` | String | Required | Material type for search filtering (e.g., "Georgette", "Cotton"). |
| `careInstructions` | String | Optional | Wash care details rendered on the product page. |

### C. The Fabric Schema (`itemType: 'FABRIC'`)
* **Why it exists:** Unstitched materials are sold by length, not by standard sizes.
| Field | Type | Rules | Why this exists |
| :--- | :--- | :--- | :--- |
| `lengthMeters` | Number | Required | Indicates the raw material length provided to the customer. |
| `allowCustomTailoring`| Boolean | Default: `false` | If true, the frontend checkout flow intercepts the order and renders a custom measurement input form. |

---

## 4. Indexing & Performance Strategy

To ensure the catalog scales to tens of thousands of items without search degradation, we enforce the following indexes at the MongoDB layer.

* **Compound Index 1 (Catalog Browsing):** `{ isActive: 1, itemType: 1, createdAt: -1 }` 
  * *Why:* When a user clicks "View All Bangles", the database filters by active items, then by bangles, and sorts by newest. This index covers that exact query, preventing full-collection scans.
* **Text Index (Global Search):** `{ name: "text", description: "text", tags: "text" }` 
  * *Why:* Enables extremely fast keyword lookups directly in the database. This saves the infrastructure cost and maintenance burden of deploying an ElasticSearch cluster for a startup.
* **Unique Index (Inventory):** `{ sku: 1 }` 
  * *Why:* Acts as a final database-level firewall to prevent two products from ever sharing the same warehouse barcode.