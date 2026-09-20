import { TaxEngine, TaxProfile } from "@modules/orders/tax.utils";
import { AppError } from "@shared/utils/app-error";

describe("TaxEngine.calculateLineItemTax", () => {
  describe("rate resolution", () => {
    it("applies 3% to IMITATION_JEWELLERY", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.IMITATION_JEWELLERY,
        1000,
        1,
      );
      expect(r.gstRate).toBe(3);
      expect(r.taxableValue).toBe(1000);
      expect(r.totalTax).toBe(30);
    });

    it("applies 0% to LAC_JEWELLERY (exempt)", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.LAC_JEWELLERY,
        1000,
        1,
      );
      expect(r.gstRate).toBe(0);
      expect(r.totalTax).toBe(0);
    });

    it("applies 5% to UNSTITCHED_FABRIC", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.UNSTITCHED_FABRIC,
        2000,
        1,
      );
      expect(r.gstRate).toBe(5);
      expect(r.totalTax).toBe(100);
    });

    it("applies 5% to STITCHED_APPAREL at ₹2500 (threshold inclusive)", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.STITCHED_APPAREL,
        2500,
        1,
      );
      expect(r.gstRate).toBe(5);
    });

    it("applies 5% to STITCHED_APPAREL below ₹2500", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.STITCHED_APPAREL,
        2000,
        1,
      );
      expect(r.gstRate).toBe(5);
    });

    it("applies 18% to STITCHED_APPAREL above ₹2500", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.STITCHED_APPAREL,
        2500.01,
        1,
      );
      expect(r.gstRate).toBe(18);
    });

    it("applies 18% to GENERAL_ACCESSORY", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.GENERAL_ACCESSORY,
        1000,
        1,
      );
      expect(r.gstRate).toBe(18);
    });

    it("applies 12% to FOOTWEAR", () => {
      const r = TaxEngine.calculateLineItemTax(TaxProfile.FOOTWEAR, 1000, 1);
      expect(r.gstRate).toBe(12);
    });
  });

  describe("computation", () => {
    it("multiplies taxable value by quantity", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.IMITATION_JEWELLERY,
        500,
        3,
      );
      expect(r.taxableValue).toBe(1500);
      expect(r.totalTax).toBe(45);
    });

    it("rounds tax to 2 decimal places (float safety)", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.GENERAL_ACCESSORY,
        33.33,
        3,
      );
      expect(r.taxableValue).toBe(99.99);
      expect(r.totalTax).toBe(18);
    });

    it("handles zero quantity", () => {
      const r = TaxEngine.calculateLineItemTax(
        TaxProfile.IMITATION_JEWELLERY,
        1000,
        0,
      );
      expect(r.taxableValue).toBe(0);
      expect(r.totalTax).toBe(0);
    });
  });

  describe("error handling", () => {
    it("throws AppError for an unknown tax profile", () => {
      expect(() =>
        TaxEngine.calculateLineItemTax("INVALID_PROFILE" as TaxProfile, 100, 1),
      ).toThrow(AppError);
    });
  });
});

describe("TaxEngine.calculateShippingTax", () => {
  it("returns zero tax when shipping is free", () => {
    const r = TaxEngine.calculateShippingTax(0);
    expect(r.taxableValue).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.gstRate).toBe(18);
  });

  it("reverse-calculates 18% GST from gross charge (clean numbers)", () => {
    const r = TaxEngine.calculateShippingTax(118);
    expect(r.taxableValue).toBe(100);
    expect(r.totalTax).toBe(18);
    expect(r.gstRate).toBe(18);
  });

  it("handles non-round gross charge", () => {
    const r = TaxEngine.calculateShippingTax(100);
    expect(r.taxableValue).toBe(84.75);
    expect(r.totalTax).toBe(15.25);
  });
});

describe("TaxEngine.splitTaxByState", () => {
  it("splits 50/50 CGST/SGST for intra-state (WB → WB)", () => {
    const r = TaxEngine.splitTaxByState(100, "WB");
    expect(r.cgst).toBe(50);
    expect(r.sgst).toBe(50);
    expect(r.igst).toBe(0);
  });

  it("charges full IGST for inter-state (WB → MH)", () => {
    const r = TaxEngine.splitTaxByState(100, "MH");
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.igst).toBe(100);
  });

  it("is case-insensitive", () => {
    const r = TaxEngine.splitTaxByState(100, "wb");
    expect(r.cgst).toBe(50);
  });

  it("trims whitespace from state code", () => {
    const r = TaxEngine.splitTaxByState(100, "  WB  ");
    expect(r.cgst).toBe(50);
  });

  it("rounds odd splits correctly", () => {
    const r = TaxEngine.splitTaxByState(99.99, "WB");
    expect(r.cgst).toBe(50);
    expect(r.sgst).toBe(50);
  });
});
