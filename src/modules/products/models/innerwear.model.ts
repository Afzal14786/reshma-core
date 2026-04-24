import { Schema } from 'mongoose';
import { Product } from './base-product.model';
import { IInnerwearProduct } from '../interfaces';

export const Innerwear = Product.discriminator<IInnerwearProduct>('INNERWEAR', new Schema({
    cupSizes: {
        type: [String],
        required: true,
        enum: ['32B', '34B', '36C', '34C', '36D'],
    },
    isReturnable: { 
        type: Boolean, 
        default: false, 
        set: () => false // Security lock: Overwrites any attempt to set this to true
    }
}));