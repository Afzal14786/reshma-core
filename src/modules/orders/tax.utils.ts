import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * TAX PROFILES
 * Legally maps to specific HSN chapters and government-defined thresholds.
 * Covers the entire boutique inventory from bottom to top.
 */
export enum TaxProfile {
  IMITATION_JEWELLERY = "IMITATION_JEWELLERY", // 3% Flat (Bangles, Earrings)
  LAC_JEWELLERY = "LAC_JEWELLERY", // 0% Exempt (Artisan Bangles)
  UNSTITCHED_FABRIC = "UNSTITCHED_FABRIC", // 5% Flat (Sarees, Unstitched Suits)
  STITCHED_APPAREL = "STITCHED_APPAREL", // 5% (<= 2500) or 18% (> 2500) (Lehengas, Blouses, Innerwear)
  GENERAL_ACCESSORY = "GENERAL_ACCESSORY", // 18% Flat (Potlis, Clutches, Handbags, Belts)
  FOOTWEAR = "FOOTWEAR", // 12% Flat (Juttis, Mojaris, Heels)
}

export interface ITaxCalculationResult {
  taxableValue: number;
  gstRate: number;
  totalTax: number;
}

export interface ITaxSplitResult {
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * DYNAMIC TAX ENGINE
 * * ARCHITECTURE NOTE:
 * This engine calculates GST on the "Transaction Value" (post-discount price)
 * at the line-item level to ensure strict compliance with Indian Tax Law.
 */
export class TaxEngine {
  // Hardcoded Business Origin State (West Bengal)
  private static readonly BUSINESS_STATE_CODE = "WB";

  /**
   * SECURITY UTILITY: Float Precision Failsafe
   * Guarantees precise financial math to prevent Razorpay penny-mismatch errors.
   */
  private static roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * @method calculateLineItemTax
   * @description Resolves the dynamic GST rate based on the profile and final discounted price.
   */
  public static calculateLineItemTax(
    taxProfile: TaxProfile,
    discountedPricePerUnit: number,
    quantity: number,
  ): ITaxCalculationResult {
    let gstRate = 0;

    // 1. Resolve dynamic tax brackets based on profile and transaction value
    switch (taxProfile) {
      case TaxProfile.IMITATION_JEWELLERY:
        gstRate = 3;
        break;
      case TaxProfile.LAC_JEWELLERY:
        gstRate = 0;
        break;
      case TaxProfile.UNSTITCHED_FABRIC:
        gstRate = 5;
        break;
      case TaxProfile.STITCHED_APPAREL:
        // Indian Tax Law: Threshold-based taxation on the transaction value
        gstRate = discountedPricePerUnit > 2500 ? 18 : 5;
        break;
      case TaxProfile.GENERAL_ACCESSORY:
        gstRate = 18;
        break;
      case TaxProfile.FOOTWEAR:
        gstRate = 12;
        break;
      default:
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          `Critical Tax Error: Unrecognized tax profile '${taxProfile}'. Checkout halted.`,
        );
    }

    // 2. Compute exact financial values
    const taxableValue = this.roundToTwoDecimals(
      discountedPricePerUnit * quantity,
    );
    const totalTax = this.roundToTwoDecimals(taxableValue * (gstRate / 100));

    return {
      taxableValue,
      gstRate,
      totalTax,
    };
  }

  /**
   * @method calculateShippingTax
   * @description Shipping is a service and strictly attracts an 18% flat GST.
   * If a user pays 100 for shipping, 84.74 is the base service, 15.26 is the tax.
   */
  public static calculateShippingTax(
    grossShippingCharge: number,
  ): ITaxCalculationResult {
    if (grossShippingCharge === 0) {
      return { taxableValue: 0, gstRate: 18, totalTax: 0 };
    }

    const gstRate = 18;
    // Reverse calculation: Base = Gross / (1 + (Rate / 100))
    const taxableValue = this.roundToTwoDecimals(grossShippingCharge / 1.18);
    const totalTax = this.roundToTwoDecimals(
      grossShippingCharge - taxableValue,
    );

    return {
      taxableValue,
      gstRate,
      totalTax,
    };
  }

  /**
   * @method splitTaxByState
   * @description Determines if the transaction is intra-state (CGST+SGST) or inter-state (IGST).
   */
  public static splitTaxByState(
    totalTaxAmount: number,
    customerStateCode: string,
  ): ITaxSplitResult {
    // Sanitize inputs to prevent case-sensitivity bugs
    const origin = this.BUSINESS_STATE_CODE.trim().toUpperCase();
    const destination = customerStateCode.trim().toUpperCase();

    if (origin === destination) {
      // Intra-state (West Bengal to West Bengal): Split 50/50
      const splitAmount = this.roundToTwoDecimals(totalTaxAmount / 2);
      return {
        cgst: splitAmount,
        sgst: splitAmount,
        igst: 0,
      };
    } else {
      // Inter-state (West Bengal to Any Other State): 100% IGST
      return {
        cgst: 0,
        sgst: 0,
        igst: this.roundToTwoDecimals(totalTaxAmount),
      };
    }
  }
}
