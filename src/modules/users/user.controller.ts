import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";
import { User } from "./user.model";
import { AppError } from "../../shared/utils/app-error";
import { HTTP_STATUS } from "../../shared/constant/http-codes";
import { ApiResponse } from "../../shared/utils/api-response";
import { uploadBufferToCloudinary } from "../../config/cloudinary";
import { ExportQueueManager } from "@shared/queues/export.queue";

import { UpdateProfileInput } from "./dtos/update-profile.dto";
import { AddAddressInput, UpdateAddressInput } from "./dtos/address.dto";
import { UpdatePasswordInput } from "./dtos/security.dto";

/**
 * ENTERPRISE USER CONTROLLER
 * * ARCHITECTURE NOTE:
 * This layer acts strictly as the HTTP boundary. Its responsibilities are limited to:
 * 1. Extracting parameters, payloads, and the authenticated user ID.
 * 2. Enforcing that authentication exists before proceeding.
 * 3. Delegating complex business logic to the UserService.
 * 4. Wrapping the result in our standardized ApiResponse class.
 * 5. Catching all async errors and passing them to the global Error Middleware via `next()`.
 */
export class UserController {
  /**
   * @route   GET /api/v1/users/profile
   * @desc    Retrieves the currently authenticated user's profile and embedded address book.
   * @access  Private (Requires JWT)
   */
  public static async getProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Double-casting to satisfy strict TS rules for ObjectId -> string conversion
      const userId = req.user?._id as unknown as string;
      if (!userId) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      const user = await UserService.getProfile(userId);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Profile retrieved successfully",
        user,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/users/profile
   * @desc    Updates core identity details (firstname, lastname, phone, gender, dob).
   *          Protected by the Zod UpdateProfileSchema to prevent Mass Assignment.
   * @access  Private (Requires JWT)
   */
  public static async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      // Safe casting: The Validation Middleware guarantees this payload perfectly matches the DTO
      const payload = req.body as UpdateProfileInput;
      const updatedUser = await UserService.updateProfile(userId, payload);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Profile updated successfully",
        updatedUser,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/v1/users/profile/avatar
   * @desc    Intercepts a multipart/form-data request, pipes the memory buffer to Cloudinary,
   *          and updates the user's avatar URL string.
   * @access  Private (Requires JWT)
   */
  public static async uploadAvatar(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      // Failsafe: Ensure Multer successfully intercepted and attached the file buffer
      if (!req.file || !req.file.buffer) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Image file is required");
      }

      // Pipe the raw memory buffer directly to our Cloudinary pipeline
      const avatarUrl = await uploadBufferToCloudinary(
        req.file.buffer,
        "avatars",
      );

      // Bypass UserService for this single, highly specific string mutation
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { avatar: avatarUrl } },
        { new: true },
      ).lean();

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Avatar uploaded successfully",
        updatedUser,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * ADDRESS BOOK ROUTING (LOGISTICS ENGINE)
   */

  /**
   * @route   POST /api/v1/users/profile/addresses
   * @desc    Pushes a new shipping/billing location into the embedded array.
   * @access  Private (Requires JWT)
   */
  public static async addAddress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId)
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");

      const payload = req.body as AddAddressInput;
      const updatedUser = await UserService.addAddress(userId, payload);

      new ApiResponse(
        res,
        HTTP_STATUS.CREATED,
        "Address added successfully",
        updatedUser.addresses,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/users/profile/addresses/:addressId
   * @desc    Mutates a specific embedded address or triggers the atomic isDefault toggle logic.
   * @access  Private (Requires JWT)
   */
  public static async updateAddress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      const addressId = req.params.addressId as string;

      if (!userId)
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      if (!addressId)
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Address ID parameter is required",
        );

      const payload = req.body as UpdateAddressInput;
      const updatedUser = await UserService.updateAddress(
        userId,
        addressId,
        payload,
      );

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Address updated successfully",
        updatedUser.addresses,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/v1/users/profile/addresses/:addressId
   * @desc    Removes an address and autonomously re-assigns a new default if necessary.
   * @access  Private (Requires JWT)
   */
  public static async deleteAddress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      const addressId = req.params.addressId as string;

      if (!userId)
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      if (!addressId)
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Address ID parameter is required",
        );

      const updatedUser = await UserService.deleteAddress(userId, addressId);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Address deleted successfully",
        updatedUser.addresses,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * SECURITY ROUTING
   */

  /**
   * @route   POST /api/v1/users/profile/security/password/otp
   * @desc    Generates and emails a 6-digit OTP for step-up authentication.
   * @access  Private
   */
  public static async requestPasswordOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId)
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");

      await UserService.sendPasswordUpdateOtp(userId);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "OTP sent to registered email",
        null,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/users/profile/security/password
   * @desc    Change account password (requires valid OTP + current password)
   * @access  Private
   */
  public static async updatePassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId)
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");

      const payload = req.body as UpdatePasswordInput;
      await UserService.updatePassword(userId, payload);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Security credentials updated successfully",
        null,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * DPDP / GDPR LEGAL ENGINE
   */

  /**
   * @route   DELETE /api/v1/users/profile
   * @desc    Right to be Forgotten. Triggers the ACID Saga to delete ephemeral state,
   * anonymize financial records, and permanently erase the identity.
   * @access  Private (Requires JWT)
   */
  public static async deleteAccount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?._id as unknown as string;
      if (!userId) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      // Execute the Master Deletion Transaction
      await UserService.deleteAccount(userId);

      // Security: Instruct the browser to destroy the HttpOnly session cookie
      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Account successfully deleted and personal data anonymized.",
        null,
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/v1/users/profile/export
   * @desc    DPDP/GDPR Data Portability. Drops the user into the background compilation queue.
   * @access  Private (Requires JWT)
   */
  public static async exportData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // 1. Authentication Check
      const userId = req.user?._id as unknown as string;
      if (!userId || !req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
      }

      // 2. Fire and Forget to BullMQ
      // We do not await the actual data compilation, only the Redis insertion.
      await ExportQueueManager.enqueueDataExport(
        userId,
        req.user.email,
        req.user.firstname,
      );

      // 3. Instant Client Response
      // 202 Accepted tells the client: "We got the request, but processing isn't finished yet."
      new ApiResponse(
        res,
        HTTP_STATUS.ACCEPTED, // 202
        "Your data export has been queued. We will email you the file shortly.",
        null,
      ).send();
    } catch (error) {
      next(error);
    }
  }
}
