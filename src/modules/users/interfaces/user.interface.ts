import { Document, Types } from "mongoose";

export type AuthProvider = "LOCAL" | "GOOGLE";
export type UserRole = "ADMIN" | "USER";

/**
 * @interface IAddress
 * @description Embedded sub-document representing a physical shipping/billing location.
 * Maintained as an array within the User document since a typical customer rarely
 * exceeds 3-5 saved addresses, keeping the document size well optimized.
 */
export interface IAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  label: "HOME" | "WORK" | "OTHER";
  isDefault: boolean; // UI uses this to auto-select the shipping address at checkout
}

/**
 * @interface IUserPreferences
 * @description Manages user consent for marketing channels.
 * Crucial for remaining compliant with TRAI (India) spam regulations.
 */
export interface IUserPreferences {
  newsletter: boolean;
  smsAlerts: boolean;
  privacyPolicyAcceptedAt?: Date;
}

/**
 * @interface IUser
 * @description The core User entity and aggregate root for the platform.
 * * ARCHITECTURE NOTE:
 * In accordance with Domain-Driven Design (DDD), this schema strictly contains
 * identity, profile, and platform-wide state data. Highly mutable or infinitely
 * growing data (like Orders, Carts, or Browsing History) are intentionally
 * decoupled into separate collections referencing this `_id`. This prevents
 * MongoDB document bloat (16MB limit) and guarantees lightning-fast login queries.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;

  // --- Identity & Authentication Pipeline ---
  authProvider: AuthProvider;
  googleId?: string; // Nullable: Only populated if authProvider is 'GOOGLE'
  email: string; // Primary unique identifier for all communications
  password?: string; // Nullable: Omitted for OAuth users
  role: UserRole; // Determines RBAC (Role-Based Access Control) across the API

  // --- Demographics & Fulfillment Profile ---
  firstname: string;
  lastname: string;
  phone?: string; // Used as the primary contact for courier dispatch (Delhivery/Shiprocket)
  avatar?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dob?: Date; // Leveraged by the marketing engine for automated birthday discount campaigns

  // --- Financials & Platform Engagement ---
  addresses: IAddress[];
  wishlist: Types.ObjectId[]; // Soft references to Product catalog for quick UI rendering
  razorpayCustomerId?: string; // Vault ID to allow seamless 1-click checkouts without re-entering UPI/Card details
  loyaltyPoints: number; // Internal platform currency (e.g., 1 point = ₹1)

  // --- Account State & Telemetry ---
  preferences: IUserPreferences;
  isEmailVerified: boolean; // Gates checkout; users must verify email to place COD orders
  isActive: boolean; // Soft-delete flag; used to ban fraudulent buyers without destroying order history references
  failedLoginAttempts: number; // Security
  lockUntil: Date | null; // Lockout Mechanism
  lastLogin?: Date; // Telemetry: Used to identify inactive accounts for re-engagement campaigns

  // 2FA & Security enhancement
  twoFactorSecret?: string; // Encrypted TOTP secret (select: false)
  isTwoFactorEnabled: boolean; // Is 2FA active for this user?
  twoFactorBackupCodes?: string[]; // Hashed backup codes (select: false)

  // --- Timestamps (Managed by Mongoose) ---
  createdAt: Date;
  updatedAt: Date;

  // --- Domain Methods ---
  /**
   * Securely compares a raw candidate password against the stored bcrypt hash.
   * @param candidatePassword - The plain text password from the login request
   * @returns boolean indicating if the password matches
   */
  comparePassword(candidatePassword: string): Promise<boolean>;
}
