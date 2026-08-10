import { Request, Response } from "express";
import { ProductService } from "../product.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * Public Product Controller
 * Handles customer-facing operations. These endpoints are heavily optimized
 * for read speed and will endure the highest volume of traffic.
 */
export class PublicProductController {
  /**
   * Fetches the catalog. Supports pagination, category filtering, and text search.
   */
  public static async getProducts(req: Request, res: Response) {
    // req.query has been coerced and sanitized by Zod (e.g., strings to numbers)
    const queryData = req.query as any;

    const result = await ProductService.getProducts(queryData);

    // Utilize the .send() method of the ApiResponse class directly
    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Catalog retrieved successfully",
      result,
    ).send();
  }

  /**
   * Fetches a single product by its MongoDB ObjectId.
   */
  public static async getProductById(req: Request, res: Response) {
    // Explicitly assert as string. Zod middleware guarantees this exists and is valid.
    const id = req.params.id as string;

    const product = await ProductService.getProductById(id);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Product retrieved successfully",
      { product },
    ).send();
  }
}
