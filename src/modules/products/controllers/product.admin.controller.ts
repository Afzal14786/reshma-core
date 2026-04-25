import { Request, Response } from "express";
import { ProductService } from "../product.service";
import { ApiResponse } from "../../../shared/utils/api-response";
import { HTTP_STATUS } from "../../../shared/constant/http-codes";

/**
 * Admin Product Controller
 * Handles restricted catalog operations: Creation, Updating, and Soft Deletions.
 * * * ARCHITECTURE NOTE (Express 5):
 * Because we are utilizing Express 5, we do not need to wrap every method in a `catchAsync`
 * utility. Express 5 natively handles rejected promises and passes them down to our
 * Global Error Handler automatically.
 */
export class AdminProductController {
  /**
   * Creates a new polymorphic product and processes image uploads.
   */
  public static async createProduct(req: Request, res: Response) {
    // req.body is already sanitized and strictly typed by our Zod Validator
    const payload = req.body;

    // req.files is populated by the Multer memory storage middleware
    const files = req.files as Express.Multer.File[];

    const product = await ProductService.createProduct(payload, files);

    // Utilize the .send() method of the ApiResponse class directly
    return new ApiResponse(
      res,
      HTTP_STATUS.CREATED,
      "Product created successfully",
      { product },
    ).send();
  }

  /**
   * Partially updates an existing product.
   */
  public static async updateProduct(req: Request, res: Response) {
    // Explicitly assert as string. Zod middleware guarantees this exists and is valid.
    const id = req.params.id as string;
    const payload = req.body;

    const product = await ProductService.updateProduct(id, payload);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Product updated successfully",
      { product },
    ).send();
  }

  /**
   * Soft deletes a product from the public catalog.
   */
  public static async deleteProduct(req: Request, res: Response) {
    // Explicitly assert as string. Zod middleware guarantees this exists and is valid.
    const id = req.params.id as string;

    await ProductService.softDeleteProduct(id);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Product successfully removed from public catalog",
      null,
    ).send();
  }
}
