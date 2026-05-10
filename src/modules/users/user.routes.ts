import { Router } from "express";
import { UserController } from "./user.controller";
import { protect } from "@shared/middlewares/auth.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { upload } from "@shared/middlewares/upload.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";
import { UpdateProfileSchema } from "./dtos/update-profile.dto";
import { AddAddressSchema, UpdateAddressSchema } from "./dtos/address.dto";
import { UpdatePasswordSchema } from "./dtos/security.dto";

const router = Router();

/**
 * USER MODULE ROUTER
 * All routes in this file are implicitly prefixed with `/api/v1/users`
 * by the main Express application router.
 */

// Global Rate Limiter for all user profile mutations
// This satisfies CodeQL requirements and prevents CPU exhaustion from brute-force/DoS attacks.
router.use(standardLimiter);

// IDENTITY & PROFILE MANAGEMENT

/**
 * @route   GET /api/v1/users/me
 * @desc    Fetch the authenticated user's profile and logistics data
 * @access  Private (Requires valid JWT)
 */
router.get("/profile", protect, UserController.getProfile);

/**
 * @route   PATCH /api/v1/users/me
 * @desc    Update demographic data. Blocked by Zod Mass Assignment firewall.
 * @access  Private
 */
router.patch(
  "/profile",
  protect,
  validate(UpdateProfileSchema),
  UserController.updateProfile,
);

/**
 * @route   DELETE /api/v1/users/profile
 * @desc    DPDP / GDPR Right to be Forgotten. Permanently deletes the account and anonymizes data.
 * @access  Private
 */
router.delete("/profile", protect, UserController.deleteAccount);

/**
 * @route   POST /api/v1/users/profile/export
 * @desc    DPDP / GDPR Data Portability. Asynchronously compiles user data and emails it.
 * @access  Private
 */
router.post("/profile/export", protect, UserController.exportData);

/**
 * @route   POST /api/v1/users/me/avatar
 * @desc    Uploads a new avatar image to Cloudinary
 * @access  Private
 * @note    `upload.single("avatar")` intercepts the multipart/form-data request,
 *          validates the file type/size, and attaches the buffer to `req.file`.
 */
router.post(
  "/profile/avatar",
  protect,
  upload.single("avatar"),
  UserController.uploadAvatar,
);

// LOGISTICS (ADDRESS BOOK)

/**
 * @route   POST /api/v1/users/me/addresses
 * @desc    Add a new address to the user's address book
 * @access  Private
 */
router.post(
  "/profile/addresses",
  protect,
  validate(AddAddressSchema),
  UserController.addAddress,
);

/**
 * @route   PATCH /api/v1/users/me/addresses/:addressId
 * @desc    Update specific fields of an address or set it as default
 * @access  Private
 */
router.patch(
  "/profile/addresses/:addressId",
  protect,
  validate(UpdateAddressSchema),
  UserController.updateAddress,
);

/**
 * @route   DELETE /api/v1/users/me/addresses/:addressId
 * @desc    Remove an address from the user's address book
 * @access  Private
 */
router.delete(
  "/profile/addresses/:addressId",
  protect,
  UserController.deleteAddress,
);

// SECURITY & CREDENTIALS

/**
 * @route   PATCH /api/v1/users/me/security/password
 * @desc    Change password with cryptographic current-password validation
 * @access  Private
 */
router.patch(
  "/profile/security/password",
  protect,
  validate(UpdatePasswordSchema),
  UserController.updatePassword,
);

// SECURITY & CREDENTIALS

/**
 * @route   POST /api/v1/users/profile/security/password/otp
 * @desc    Request OTP for changing password
 * @access  Private
 */
router.post(
  "/profile/security/password/otp",
  protect,
  UserController.requestPasswordOtp,
);

/**
 * @route   PATCH /api/v1/users/profile/security/password
 * @desc    Change password with cryptographic and OTP validation
 * @access  Private
 */
router.patch(
  "/profile/security/password",
  protect,
  validate(UpdatePasswordSchema),
  UserController.updatePassword,
);

export const userRoutes = router;
