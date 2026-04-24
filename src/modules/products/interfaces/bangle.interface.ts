import { IBaseProduct } from './base-product.interface';

export interface IBangleProduct extends IBaseProduct {
    itemType: 'BANGLE';
    bangleSizes: ('2.2' | '2.4' | '2.6' | '2.8')[];
    packSize: number;
}