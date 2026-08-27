import mongoose, { Types } from "mongoose";
import { User } from "./user.model";
import { IUser, IAddress } from "./interfaces/user.interface";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { redisClient } from "@config/redis";
import { NotificationService } from "../notifications/notification.service";
import logger from "@config/logger";

// Cross-Module Imports for Saga Cleanup
import { OrderService } from "../orders/order.service";
import { CartService } from "../cart/cart.service";
import { WishlistService } from "../wishlists/wishlist.service";
import { ReturnService } from "../returns/return.service";
import { SupportService } from "@modules/support/support.service";

import { UpdateProfileInput } from "./dtos/update-profile.dto";
import { AddAddressInput, UpdateAddressInput } from "./dtos/address.dto";
import { UpdatePasswordInput } from "./dtos/security.dto";

/**
 * ENTERPRISE USER SERVICE
 * Orchestrates all identity, logistics, and security state changes.
 * Adheres strictly to Zero-'any' typing and prevents mass assignment vulnerabilities.
 */
export class UserService {
  /**
   * Retrieves the sanitized profile for the authenticated user.
   */
  public static async getProfile(
    userId: string | Types.ObjectId,
  ): Promise<IUser> {
    const user = (await User.findOne({
      _id: { $eq: userId },
    }).lean()) as IUser | null;
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "User profile not found");
    }
    return user;
  }

  /**
   * Updates core demographic and identity data.
   * Prevents Mass Assignment by only accepting the heavily sanitized UpdateProfileInput.
   */
  public static async updateProfile(
    userId: string | Types.ObjectId,
    payload: UpdateProfileInput,
  ): Promise<IUser> {
    // SECURITY FIX: Explicitly map allowed fields from the DTO.
    // This stops CodeQL from tracing untrusted req.body directly to the DB sink.
    const updateData: Partial<UpdateProfileInput> = {};

    if (payload.firstname) updateData.firstname = payload.firstname;
    if (payload.lastname) updateData.lastname = payload.lastname;
    if (payload.phone) updateData.phone = payload.phone;
    if (payload.gender) updateData.gender = payload.gender;
    if (payload.dob) updateData.dob = payload.dob;

    // Find by ID and update, returning the newly modified document.
    // runValidators ensures Mongoose Schema rules (like max lengths) are enforced.
    const updatedUser = (await User.findOneAndUpdate(
      { _id: { $eq: userId } },
      { $set: updateData },
      { new: true, runValidators: true },
    ).lean()) as IUser | null;

    if (!updatedUser) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "User profile not found");
    }
    return updatedUser;
  }

  /**
   * ADDRESS BOOK (LOGISTICS ENGINE)
   */

  /**
   * Pushes a new address sub-document into the User's address array.
   * If isDefault is true, it automatically demotes the previous default address.
   */
  public static async addAddress(
    userId: string | Types.ObjectId,
    payload: AddAddressInput,
  ): Promise<IUser> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ _id: { $eq: userId } }).session(
        session,
      );
      if (!user) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");
      }

      // Enforce realistic limits to prevent document bloat
      if (user.addresses.length >= 10) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Address book limit reached (Max 10). Please delete an address first.",
        );
      }

      // If this new address is flagged as default, demote all existing addresses
      if (payload.isDefault) {
        user.addresses.forEach((addr) => {
          addr.isDefault = false;
        });
      } else if (user.addresses.length === 0) {
        // If it's their very first address, it MUST be the default
        payload.isDefault = true;
      }

      // Push the new heavily typed payload into the Mongoose Document Array
      user.addresses.push(payload as IAddress);
      await user.save({ session });

      await session.commitTransaction();
      return user.toObject() as IUser;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates a specific address sub-document atomically.
   */
  public static async updateAddress(
    userId: string | Types.ObjectId,
    addressId: string,
    payload: UpdateAddressInput,
  ): Promise<IUser> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ _id: { $eq: userId } }).session(
        session,
      );
      if (!user) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");
      }

      // Explicitly cast to the Mongoose Subdocument array type to access .id()
      const addressDoc = (
        user.addresses as mongoose.Types.DocumentArray<IAddress>
      ).id(addressId);

      if (!addressDoc) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, "Address not found");
      }

      // If user is making THIS address the new default
      if (payload.isDefault === true && !addressDoc.isDefault) {
        user.addresses.forEach((addr) => {
          addr.isDefault = false; // Demote all others
        });
      }

      // Apply specific partial updates
      if (payload.street) addressDoc.street = payload.street;
      if (payload.city) addressDoc.city = payload.city;
      if (payload.state) addressDoc.state = payload.state;
      if (payload.pincode) addressDoc.pincode = payload.pincode;
      if (payload.label) addressDoc.label = payload.label;
      if (payload.isDefault !== undefined)
        addressDoc.isDefault = payload.isDefault;

      await user.save({ session });
      await session.commitTransaction();
      return user.toObject() as IUser;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Removes an address from the array.
   * If the default address is deleted, the system autonomously assigns a new default.
   */
  public static async deleteAddress(
    userId: string | Types.ObjectId,
    addressId: string,
  ): Promise<IUser> {
    const user = await User.findOne({ _id: { $eq: userId } });
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");
    }

    const addressArray =
      user.addresses as mongoose.Types.DocumentArray<IAddress>;
    const addressDoc = addressArray.id(addressId);

    if (!addressDoc) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Address not found");
    }

    const wasDefault = addressDoc.isDefault;

    // Remove the subdocument safely
    addressArray.pull({ _id: addressId });

    // If they deleted their default address, and they still have other addresses left,
    // we must autonomously assign a new default so checkout doesn't break.
    if (wasDefault && addressArray.length > 0) {
      const nextDefault = addressArray[0];
      if (nextDefault) {
        nextDefault.isDefault = true;
      }
    }

    await user.save();
    return user.toObject() as IUser;
  }

  /**
   * SECURITY ENGINE (STEP-UP AUTHENTICATION)
   */

  /**
   * Generates a 6-digit OTP, stores it in Redis (10 min expiry), and delegates
   * email dispatch to the Notification Facade.
   */
  public static async sendPasswordUpdateOtp(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const user = (await User.findOne({
      _id: { $eq: userId },
    }).lean()) as IUser | null;
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    if (user.authProvider === "GOOGLE") {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "OAuth accounts do not use passwords",
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with a 10-minute (600 seconds) expiration
    const TTL_SECONDS = 600; // 10 minutes
    const expiryTimeIso = new Date(
      Date.now() + TTL_SECONDS * 1000,
    ).toISOString();

    // Store in Redis with a 10-minute expiration
    const redisKey = `pwd_update_otp:${userId.toString()}`;
    await redisClient.setEx(redisKey, TTL_SECONDS, otp);

    // Delegate to Notification Facade (No queue logic here)
    await NotificationService.sendPasswordUpdateOtp(
      user.email,
      user.firstname,
      otp,
      expiryTimeIso,
    );
  }

  /**
   * Executes a secure cryptographic handshake requiring a valid Redis OTP + Current Password.
   * Completes by delegating a security alert to the Notification Facade.
   */
  public static async updatePassword(
    userId: string | Types.ObjectId,
    payload: UpdatePasswordInput,
  ): Promise<void> {
    const redisKey = `pwd_update_otp:${userId.toString()}`;
    const storedOtp = await redisClient.get(redisKey);

    // Verify OTP
    if (!storedOtp || storedOtp !== payload.otp) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Invalid or expired OTP");
    }

    // Fetch User with hidden password field
    const user = await User.findOne({ _id: { $eq: userId } }).select(
      "+password",
    );
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    // Cryptographic Handshake
    const isMatch = await user.comparePassword(payload.currentPassword);
    if (!isMatch) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Current password is incorrect",
      );
    }

    // Update and Save (Triggers Mongoose bcrypt pre-save hook)
    user.password = payload.newPassword;
    await user.save();

    // Cleanup Redis
    await redisClient.del(redisKey);

    // Security Alert: Delegate to Notification Facade to handle email and in-app alerts
    await NotificationService.sendPasswordUpdateConfirmation(
      user._id,
      user.email,
      user.firstname,
    );
  }

  /**
   * DPDP / GDPR Legal Engine: The Master Orchestrator (Right to be Forgotten)
   * * ARCHITECTURE NOTE:
   * Uses a Saga Pattern wrapped in a MongoDB Transaction.
   * 1. Wipes ephemeral states (Cart/Wishlist).
   * 2. Scrambles PII in immutable financial records (Orders/Returns).
   * 3. Irreversibly deletes the User Document.
   */
  public static async deleteAccount(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    try {
      // 1. Wipe Ephemeral State (Free up DB storage)
      await CartService.deleteUserCart(safeUserId, session);
      await WishlistService.deleteUserWishlist(safeUserId, session);

      // 2. Anonymize Immutable Financial Records (Preserve tax math, destroy PII)
      await OrderService.anonymizeUserOrders(safeUserId, session);
      await ReturnService.anonymizeUserReturns(safeUserId, session);
      await SupportService.anonymizeUserTickets(safeUserId, session);

      // 3. Destroy the Identity
      const deletedUser = await User.findOneAndDelete({
        _id: { $eq: safeUserId },
      }).session(session);

      if (!deletedUser) {
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          "User profile not found or already deleted.",
        );
      }

      await session.commitTransaction();
      logger.info(
        `[Privacy Engine] Legal account deletion completed successfully for user ${safeUserId}`,
      );

      // FIRE AND FORGET:
      // Any active Access Tokens (JWT) will naturally expire within 15 minutes.
      // Refresh Tokens will naturally fail upon their next use because User.findOne() will return null.
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `[Privacy Engine] Critical Failure during account deletion for user ${safeUserId}. Rollback executed.`,
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
