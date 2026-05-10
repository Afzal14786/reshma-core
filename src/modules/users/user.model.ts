import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { IUser, IAddress } from "./interfaces/user.interface";

const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    label: { type: String, enum: ["HOME", "WORK", "OTHER"], required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
); // _id is preserved so the frontend can target specific addresses for updates/deletions

const UserSchema = new Schema<IUser>(
  {
    // --- Identity & Authentication ---
    authProvider: {
      type: String,
      enum: ["LOCAL", "GOOGLE"],
      default: "LOCAL",
      required: true,
    },

    // @Index sparse:true -> Allows multiple local users to have a null googleId without throwing a Duplicate Key Error
    googleId: { type: String, unique: true, sparse: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // @Security select:false -> Prevents accidental exposure of the hash in standard User.find() queries
    password: { type: String, select: false },
    role: { type: String, enum: ["ADMIN", "USER"], default: "USER" },

    // --- Personal Profile ---
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },

    // @Index sparse:true -> Users signing up via Google will not have a phone number initially
    phone: { type: String, sparse: true, unique: true },
    avatar: {
      type: String,
      default:
        "https://res.cloudinary.com/demo/image/upload/v1/default_avatar.png",
    },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"] },
    dob: { type: Date },

    // --- E-Commerce & Financials ---
    addresses: [AddressSchema],
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    razorpayCustomerId: { type: String, sparse: true, unique: true },
    loyaltyPoints: { type: Number, default: 0 },

    // --- State & Preferences ---
    preferences: {
      newsletter: { type: Boolean, default: true }, // Default opt-in for aggressive marketing growth
      smsAlerts: { type: Boolean, default: true },
      // ARCHITECTURE NOTE: This timestamp proves exactly when the user consented to data collection.
      privacyPolicyAcceptedAt: { type: Date },
    },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

/**
 * Pre-Save Hook (Data Mutation layer)
 * Automatically intercepts the document before writing to the database to ensure
 * passwords are never stored in plain text.
 */
UserSchema.pre("save", async function () {
  // Escape hatch: Only trigger the expensive hashing algorithm if the password was actually altered
  if (!this.isModified("password") || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance Method (Domain Logic)
 * Encapsulates the hashing verification within the model, keeping controllers clean.
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false; // Failsafe for OAuth accounts lacking a password
  return bcrypt.compare(candidatePassword, this.password);
};

// Export the compiled model
export const User = mongoose.model<IUser>("User", UserSchema);
