<div align="center">

  # Media & Storage Architecture
  
  **The stateless, memory‑streamed image optimisation pipeline for Reshma‑Core.**

  [![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_Pipeline-3448C5?style=flat&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
  [![Multer](https://img.shields.io/badge/Multer-Memory_Storage-FF9900?style=flat)](https://github.com/expressjs/multer)
  [![Node.js](https://img.shields.io/badge/Node.js-Streams-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

## 1. Cloud‑Native Storage Strategy

Traditional monolithic applications save uploaded files to the server’s local disk. This fails at scale:

- **Ephemeral containers** – Docker containers lose local storage on restart.
- **Horizontal scaling** – An image uploaded to Container A is invisible to users routed to Container B.

**Reshma‑Core solution: Stateless memory streams**

We adhere to the **12‑Factor App** methodology – our Node.js servers are 100% stateless.  
When a user uploads a file, `multer.memoryStorage()` holds the file briefly in RAM as a `Buffer`, then streams it directly to **Cloudinary** over HTTP. **Zero bytes are ever written to the local file system.**

---

## 2. Security Firewalls (Multer)

Accepting `multipart/form-data` from the public internet is a major security vector. Our `upload.middleware.ts` enforces multiple firewalls **before** the payload reaches any controller.

| Security Vector | Implementation | Description |
|----------------|----------------|-------------|
| **Malicious scripts** | `fileFilter` MIME validation | Allows only `image/jpeg`, `image/png`, `image/webp`, `image/jpg`. Others rejected with `HTTP_STATUS.BAD_REQUEST` (400). |
| **OOM / DDoS attacks** | `limits: { fileSize: 10 * 1024 * 1024 }` | Hard **10MB per file** limit. Larger files rejected immediately. |
| **Array bounding** | `uploadProductImage = upload.array("images", 5)` | Limits product uploads to exactly 5 images, preventing payload stuffing. |

**Complete code from `upload.middleware.ts`:**
```typescript
import multer from "multer";
import { Request } from "express";
import { AppError } from "../utils/app-error";
import { HTTP_STATUS } from "../constant/http-codes";

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(HTTP_STATUS.BAD_REQUEST, "Invalid file type. Only JPEG, PNG, and WebP are allowed."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

export const uploadProductImage = upload.array("images", 5);
```   

> **Note:** The `HTTP_STATUS` constants are defined in `src/shared/constant/http-codes.ts` (e.g., `BAD_REQUEST` = 400).  

---  

## 3. Cloudinary Upload Pipeline (`cloudinary.ts`)

### 3.1 Memory‑Stream Upload

The `uploadBufferToCloudinary` function uploads a raw Buffer directly to Cloudinary without touching disk.  

**Code from `cloudinary.ts`:**  

```typescript
export const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  folderName: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `reshma-core/${folderName}`,
        format: "webp",      // Force WebP conversion
        quality: "auto",     // AI‑driven compression
      },
      (error, result) => {
        if (error || !result) {
          return reject(new Error(error?.message || "Failed to upload image"));
        }
        resolve(result.secure_url);
      },
    );
    uploadStream.end(fileBuffer);
  });
};
```   

### 3.2 Forced WebP Conversion

No matter the original format (PNG, JPEG, etc.), we instruct Cloudinary to output WebP, which provides up to 30% better compression than JPEG with identical visual fidelity. This dramatically reduces bandwidth for mobile users.

### 3.3 AI‑Driven Quality (`quality: "auto"`)

Instead of guessing a hardcoded compression percentage, we use Cloudinary’s machine learning to determine the maximum compression ratio that does not introduce visible artefacts.   

---   

## 4. Orphaned Asset Cleanup

When a product is permanently deleted (hard delete), the associated images in Cloudinary become orphaned and continue to incur costs. A Mongoose `pre('findOneAndDelete')` hook automatically deletes them (see `base-product.model.ts`). The hook calls `deleteFromCloudinary`.

### 4.1 Extracting Public ID (`extractPublicId`)

To delete an image, we need its `public_id` from the Cloudinary URL. The utility parses the URL safely:  

**Code from `cloudinary.ts`:**  

```typescript
export const extractPublicId = (secureUrl: string): string => {
  const splitUrl = secureUrl.split("/");
  const fileWithExtension = splitUrl.pop() || "";
  const folderPath = splitUrl.slice(splitUrl.indexOf("reshma-core")).join("/");
  const publicId = fileWithExtension.split(".")[0];
  return `${folderPath}/${publicId}`;
};
```  
**Example:**  
URL: `https://res.cloudinary.com/.../reshma-core/products/bangle/abcd1234.webp`  
Extracted `publicId`: `reshma-core/products/bangle/abcd1234`  

### 4.2 Fault‑Tolerant Deletion (`deleteFromCloudinary`)  
The deletion utility wraps the Cloudinary `destroy` call in a `try/catch` and **never throws**. This prevents a Cloudinary network failure from rolling back a database transaction. Errors are logged for manual inspection.   

**Code from `cloudinary.ts`:**  

```typescript
export const deleteFromCloudinary = async (secureUrl: string): Promise<void> => {
  try {
    const publicId = extractPublicId(secureUrl);
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete asset: ${secureUrl}`, error);
    // Do not throw – we log and continue.
  }
};
```  

---   
## 5. Integration with Product Service

During product creation, `ProductService.createProduct` uploads all images concurrently and rolls back if MongoDB fails (e.g., duplicate SKU).  

**Simplified code (`product.service.ts`):**  

```typescript
const uploadPromises = files.map(file =>
  uploadBufferToCloudinary(file.buffer, `products/${payload.itemType.toLowerCase()}`)
);
const imageUrls = await Promise.all(uploadPromises);

try {
  const product = await Product.create({ ...payload, images: imageUrls });
  return product;
} catch (error) {
  // Rollback: delete uploaded images if DB fails
  await Promise.allSettled(imageUrls.map(url => deleteFromCloudinary(url)));
  throw error;
}
```  

> `Promise.allSettled` ensures that even if one deletion fails, the others still run.  

---   

## 6. Error Responses & HTTP Status Codes

The module uses standard HTTP status codes from `src/shared/constant/http-codes.ts`.

| Status Code | Constant | Scenario |
|-------------|----------|----------|
| 200 | `OK` | Upload successful. |
| 400 | `BAD_REQUEST` | Invalid file type, missing file, or file exceeds size limit. |
| 413 | `PAYLOAD_TOO_LARGE` | Automatically returned by Multer when fileSize limit is exceeded (we do not override). |
| 500 | `INTERNAL_SERVER_ERROR` | Cloudinary upload failure (e.g., API timeout, invalid credentials). |

**Example error response (400):**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
  "timestamp": "2026-05-22T10:00:00.000Z"
}
```   

---  

## 7. Performance & Security Summary

| Concern | Mitigation |
|---------|-------------|
| Local disk bloat | Memory storage only – no files written to disk. |
| Malicious file types | MIME filter + Cloudinary re‑encoding strips metadata. |
| DDoS via huge uploads | 10MB per‑file limit, 5 images per request. |
| Orphaned assets | Pre‑delete hook removes images on product deletion. |
| Slow page loads | WebP + auto compression – smaller payloads. |
| Cloudinary API failures | Non‑throwing delete, rollback on creation failure. |  

---  

## 8. Related Files

| File | Purpose |
|------|---------|
| `src/config/cloudinary.ts` | Cloudinary SDK configuration, upload, delete, and extractPublicId utilities. |
| `src/shared/middlewares/upload.middleware.ts` | Multer memory storage, file filter, size limits, array bounding. |
| `src/modules/products/product.service.ts` | Uses upload utils for product image handling. |
| `src/modules/products/models/base-product.model.ts` | Mongoose pre‑delete hook for image cleanup. |
| `src/modules/returns/return.service.ts` | Uses same utilities for return evidence images. |  

---  

## Next Steps

- See how the [Product Module](../modules/product-module.md) handles image uploads during creation.
- Explore [Security Hardening](./security-hardening.md) for file upload protections.
- Understand [Edge Cache & Workers](./edge-cache.md) for PDF uploads (similar pattern).  

---  

*The Reshma-Core Team*  