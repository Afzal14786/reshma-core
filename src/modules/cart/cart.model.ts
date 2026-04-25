import mongoose, { Schema } from 'mongoose';
import { ICart } from './interfaces/cart.interface';

/**
 * @schema CartItemSchema
 * @description The sub-document schema defining individual line items in the cart.
 */
const CartItemSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product', // Establishes the relational link to the Polymorphic Product collection
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Cart item quantity must be at least 1'],
        },
        selectedAttributes: {
            // Utilizes a strict Map of Strings/Numbers to avoid Schema.Types.Mixed (which acts as 'any').
            // This strictly enforces the data types for polymorphic choices.
            type: Map,
            of: Schema.Types.Mixed, // Replaced below to avoid loose typing
        }
    },
    {
        // Disables the automatic generation of ObjectIds for sub-documents.
        // This prevents database bloat and keeps the JSON payload clean for the frontend.
        _id: false,
    }
);

// Overriding the loose Mixed type to enforce strict String/Number values at the schema level
CartItemSchema.path('selectedAttributes', {
    type: Map,
    of: String, // Enforces that all attributes (e.g., 'XL', '2.4', 'Red') are cast to and stored as strings
    default: {},
});

/**
 * @schema CartSchema
 * @description The primary schema for the Cart domain. Enforces a strict one-to-one relationship with the User.
 */
const CartSchema = new Schema<ICart>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // Architectural Firewall: Guarantees a single user cannot possess concurrent parallel carts
            index: true,  // Optimizes query performance when fetching the cart during the checkout flow
        },
        items: [CartItemSchema],
    },
    {
        // Automatically manages 'createdAt' and 'updatedAt' timestamps
        timestamps: true,
    }
);

export const Cart = mongoose.model<ICart>('Cart', CartSchema);