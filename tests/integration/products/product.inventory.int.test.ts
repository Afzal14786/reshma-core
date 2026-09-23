import { ProductService } from "@modules/products/product.service";
import { Product } from "@modules/products/models/base-product.model";
import { createTestBangle } from "@tests/helpers/product.helper";
import { AppError } from "@shared/utils/app-error";

describe("ProductService.reserveStock — atomic inventory", () => {
  it("decrements stock correctly", async () => {
    const product = await createTestBangle({ currentStock: 10 });
    await ProductService.reserveStock(String(product._id), 4);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(6);
  });

  it("rejects when insufficient stock", async () => {
    const product = await createTestBangle({ currentStock: 3 });
    await expect(
      ProductService.reserveStock(String(product._id), 5),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects when the product is inactive", async () => {
    const product = await createTestBangle({ currentStock: 10, isActive: false });
    await expect(
      ProductService.reserveStock(String(product._id), 1),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects when the product does not exist", async () => {
    await expect(
      ProductService.reserveStock("000000000000000000000000", 1),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("prevents overselling under concurrent load (atomic $gte firewall)", async () => {
    const product = await createTestBangle({ currentStock: 10 });

    const results = await Promise.allSettled([
      ProductService.reserveStock(String(product._id), 6),
      ProductService.reserveStock(String(product._id), 6),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(4);
  });

  it("never lets stock go negative", async () => {
    const product = await createTestBangle({ currentStock: 5 });

    // Try to reserve more than available
    await expect(
      ProductService.reserveStock(String(product._id), 100),
    ).rejects.toBeInstanceOf(AppError);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(5);
  });
});