import { Product } from "./models/base-product.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "@config/cloudinary";
import {
  CreateProductInput,
  UpdateProductInput,
} from "./dtos/product.admin.dto";
import { GetProductsQueryInput } from "./dtos/product.public.dto";
import { IBaseProduct } from "./interfaces/base-product.interface";

/**
 * Product Service
 * Handles all database interactions, polymorphic document creation,
 * and Cloudinary image pipelines for the catalog.
 */
export class ProductService {
  /**
   * Admin: Create a new Polymorphic Product
   * Features: Parallel Cloudinary uploads and Cloudinary Rollback
   * if the database transaction fails (e.g., Duplicate SKU).
   */
  public static async createProduct(
    payload: CreateProductInput,
    files: Express.Multer.File[],
  ): Promise<IBaseProduct> {
    // Enforce Image Requirement
    if (!files || files.length === 0) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "At least one product image must be uploaded.",
      );
    }

    // Parallel Cloudinary Uploads
    const uploadPromises = files.map((file) =>
      uploadBufferToCloudinary(
        file.buffer,
        `products/${payload.itemType.toLowerCase()}`,
      ),
    );

    const imageUrls = await Promise.all(uploadPromises);

    // Database Transaction with Distributed Rollback
    try {
      const productData = {
        ...payload,
        images: imageUrls,
      };

      const product = await Product.create(productData);
      return product;
    } catch (error) {
      // ROLLBACK: If DB creation fails (e.g., duplicate SKU), delete the uploaded images
      // to prevent Cloudinary storage bloat (Orphaned Assets).
      const rollbackPromises = imageUrls.map((url) =>
        deleteFromCloudinary(url),
      );
      await Promise.allSettled(rollbackPromises); // Use allSettled so one failed deletion doesn't crash the others

      throw error; // Rethrow to the Global Error Handler
    }
  }

  /**
   * Public: Fetch Catalog with Advanced Querying
   * Implements Pagination, Filtering, and highly-optimized MongoDB Text Searching.
   */
  public static async getProducts(queryData: GetProductsQueryInput) {
    const { page, limit, sort, q, itemType, mainCategory, subCategory } =
      queryData;

    // Build the dynamic MongoDB Query Object safely using Record
    // This avoids Mongoose versioning type errors while remaining strongly typed.
    const query: Record<string, any> = { isActive: true };

    // Text Search Optimization
    if (q) {
      query.$text = { $search: String(q) };
    }

    // Exact Match Filters
    if (itemType) query.itemType = { $eq: String(itemType) };
    if (mainCategory) query.mainCategory = { $eq: String(mainCategory) };
    if (subCategory) query.subCategory = { $eq: String(subCategory) };

    // Pagination Math
    const skip = (Number(page) - 1) * Number(limit);

    // Execute Queries in Parallel
    const [products, totalDocuments] = await Promise.all([
      Product.find(query)
        .sort(sort ? String(sort) : "-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    return {
      products,
      meta: {
        total: totalDocuments,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalDocuments / Number(limit)),
      },
    };
  }

  /**
   * Public/Admin: Fetch a single Product by ID
   */
  public static async getProductById(productId: string): Promise<IBaseProduct> {
    const product = await Product.findOne({
      _id: { $eq: String(productId) },
      isActive: true,
    }).lean();

    if (!product) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "The requested product could not be found or has been removed.",
      );
    }

    return product as unknown as IBaseProduct;
  }

  /**
   * Admin: Update Product Data
   * Performs a partial update. Mongoose will strictly validate the payload
   * against the correct discriminator schema based on the document's `itemType`.
   */
  public static async updateProduct(
    productId: string,
    payload: UpdateProductInput,
  ): Promise<IBaseProduct> {
    const sanitizedPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!key.startsWith("$")) {
        sanitizedPayload[key] = value;
      }
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: { $eq: String(productId) } },
      { $set: sanitizedPayload },
      { new: true, runValidators: true },
    );

    if (!updatedProduct) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Product not found.");
    }

    return updatedProduct;
  }

  /**
   * Admin: Soft Delete Product
   * We never permanently delete (`.deleteOne()`) products. Doing so would orphan
   * historical Order documents and break financial receipts. Instead, we hide them.
   */
  public static async softDeleteProduct(productId: string): Promise<void> {
    const result = await Product.findOneAndUpdate(
      { _id: { $eq: String(productId) } },
      { $set: { isActive: false } },
    );

    if (!result) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Product not found.");
    }
  }

  /**
   * Internal: Reserve Stock Atomically (Used during Checkout Phase)
   * * * ARCHITECTURE NOTE:
   * This method utilizes MongoDB's atomic `$inc` combined with a `$gte` query firewall.
   * This prevents Race Conditions if 10 users try to buy the last 1 item at the exact same millisecond.
   */
  public static async reserveStock(
    productId: string,
    quantityToDeduct: number,
  ): Promise<void> {
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: { $eq: String(productId) },
        currentStock: { $gte: Number(quantityToDeduct) },
        isActive: true,
      },
      {
        $inc: { currentStock: -Number(quantityToDeduct) },
      },
      { new: true },
    );

    if (!updatedProduct) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        "Insufficient stock available or product is no longer active. The transaction was aborted.",
      );
    }
  }
}
