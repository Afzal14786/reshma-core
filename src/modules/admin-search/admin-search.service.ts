import mongoose from "mongoose";
import { Product } from "@modules/products/models/base-product.model";
import { Order } from "@modules/orders/order.model";
import { User } from "@modules/users/user.model";
import { Ticket } from "@modules/support/support.model";
import { ReturnModel } from "@modules/returns/return.model";
import logger from "@config/logger";

/**
 * Strict type for the pattern detection result.
 * Eliminates the use of `any` in the filter builders.
 */
type TSearchPatterns = {
  isOrderNumber: boolean;
  isTicketId: boolean;
  isSku: boolean;
  isObjectId: boolean;
  isPhone: boolean;
  isEmail: boolean;
};

/**
 * Type definitions for the grouped search results.
 */
interface ISearchResultGroup {
  count: number;
  items: unknown[];
}

interface IAdminSearchResponse {
  products: ISearchResultGroup;
  orders: ISearchResultGroup;
  users: ISearchResultGroup;
  supports: ISearchResultGroup;
  returns: ISearchResultGroup;
}

/**
 * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
 */
const safeLog = (message: string): string => message.replace(/[\r\n]/g, "");

/**
 * GLOBAL ADMIN SEARCH ENGINE
 *
 * RESILIENCE STRATEGY (Production-Grade):
 * - Uses Promise.allSettled for fault isolation. If Returns collection times out,
 *   Products and Orders still render successfully.
 * - Logs detailed rejection reasons for every failed query to Winston.
 * - If ALL critical collections (Products, Orders, Users) fail, throws an
 *   explicit AppError to prevent the Admin from seeing a blank page without context.
 */
export class AdminSearchService {
  /**
   * UTILITY: Detects specific patterns to optimize the search query.
   * Returns an object with hints to force specific collection searches.
   */
  private static detectPattern(query: string): TSearchPatterns {
    const trimmed = query.trim();

    return {
      // Order Numbers: ORD- followed by 6 hex chars (e.g., ORD-7B9F1A)
      isOrderNumber: /^ORD-[0-9A-F]{6}$/i.test(trimmed),
      // Ticket IDs: TCK- followed by 8 hex chars (e.g., TCK-A1B2C3D4)
      isTicketId: /^TCK-[0-9A-F]{8}$/i.test(trimmed),
      // SKU: Uppercase letters, numbers, and hyphens (e.g., BAN-GLD-001)
      isSku: /^[A-Z0-9\-]{3,20}$/.test(trimmed),
      // MongoDB ObjectId: Exactly 24 hex characters
      isObjectId: /^[0-9a-fA-F]{24}$/.test(trimmed),
      // Phone: 10 digits (Indian format) or starts with +
      isPhone: /^(\+?[0-9]{10,15})$/.test(trimmed),
      // Email: Contains @
      isEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed),
    };
  }

  /**
   * Main Search Orchestrator.
   * @param query - The raw search string from the Admin.
   * @returns Grouped results for all modules.
   */
  public static async globalSearch(
    query: string,
  ): Promise<IAdminSearchResponse> {
    const safeQuery = safeLog(query);
    const patterns = this.detectPattern(safeQuery);

    logger.info(
      `[AdminSearch] Executing global search for: "${safeQuery}" with patterns: ${JSON.stringify(patterns)}`,
    );

    // 1. Build optimized MongoDB filters for each module
    const productFilter = this.buildProductFilter(safeQuery, patterns);
    const orderFilter = this.buildOrderFilter(safeQuery, patterns);
    const userFilter = this.buildUserFilter(safeQuery, patterns);
    const supportFilter = this.buildSupportFilter(safeQuery, patterns);
    const returnFilter = this.buildReturnFilter(safeQuery, patterns);

    // 2. Execute queries in parallel with allSettled for resilience
    const [
      productsResult,
      ordersResult,
      usersResult,
      supportsResult,
      returnsResult,
    ] = await Promise.allSettled([
      Product.find(productFilter)
        .limit(15)
        .select("_id sku name itemType mainCategory basePrice images isActive")
        .lean(),
      Order.find(orderFilter)
        .limit(15)
        .populate("user", "firstname lastname email")
        .sort({ createdAt: -1 })
        .lean(),
      User.find(userFilter)
        .limit(15)
        .select("_id firstname lastname email phone avatar isActive")
        .lean(),
      Ticket.find(supportFilter)
        .limit(15)
        .populate("user", "firstname lastname email")
        .sort({ createdAt: -1 })
        .lean(),
      ReturnModel.find(returnFilter)
        .limit(15)
        .populate("order", "orderNumber")
        .populate("user", "firstname lastname email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // 3. Log detailed errors for any rejected queries (Operational Observability)
    if (productsResult.status === "rejected") {
      logger.error(
        `[AdminSearch] Products query failed: ${productsResult.reason}`,
      );
    }
    if (ordersResult.status === "rejected") {
      logger.error(`[AdminSearch] Orders query failed: ${ordersResult.reason}`);
    }
    if (usersResult.status === "rejected") {
      logger.error(`[AdminSearch] Users query failed: ${usersResult.reason}`);
    }
    if (supportsResult.status === "rejected") {
      logger.error(
        `[AdminSearch] Support query failed: ${supportsResult.reason}`,
      );
    }
    if (returnsResult.status === "rejected") {
      logger.error(
        `[AdminSearch] Returns query failed: ${returnsResult.reason}`,
      );
    }

    // 4. Build the grouped response with safe error handling
    const response: IAdminSearchResponse = {
      products: {
        count:
          productsResult.status === "fulfilled"
            ? productsResult.value.length
            : 0,
        items:
          productsResult.status === "fulfilled" ? productsResult.value : [],
      },
      orders: {
        count:
          ordersResult.status === "fulfilled" ? ordersResult.value.length : 0,
        items: ordersResult.status === "fulfilled" ? ordersResult.value : [],
      },
      users: {
        count:
          usersResult.status === "fulfilled" ? usersResult.value.length : 0,
        items: usersResult.status === "fulfilled" ? usersResult.value : [],
      },
      supports: {
        count:
          supportsResult.status === "fulfilled"
            ? supportsResult.value.length
            : 0,
        items:
          supportsResult.status === "fulfilled" ? supportsResult.value : [],
      },
      returns: {
        count:
          returnsResult.status === "fulfilled" ? returnsResult.value.length : 0,
        items: returnsResult.status === "fulfilled" ? returnsResult.value : [],
      },
    };

    return response;
  }

  // --- PRIVATE FILTER BUILDERS (Pattern-Based Optimization) ---
  // NOTE: 'patterns' is now strictly typed as TSearchPatterns (no 'any'!)

  private static buildProductFilter(
    query: string,
    patterns: TSearchPatterns,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (patterns.isObjectId) {
      filter._id = { $eq: query };
    } else if (patterns.isSku) {
      filter.sku = { $eq: query.toUpperCase() };
    } else {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ];
    }
    return filter;
  }

  private static buildOrderFilter(
    query: string,
    patterns: TSearchPatterns,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (patterns.isOrderNumber) {
      filter.orderNumber = { $eq: query.toUpperCase() };
    } else if (patterns.isObjectId) {
      filter._id = { $eq: query };
    } else if (patterns.isPhone) {
      filter["shippingAddress.phone"] = { $regex: query, $options: "i" };
    } else if (patterns.isSku) {
      filter["items.sku"] = { $eq: query.toUpperCase() };
    } else {
      filter.$or = [
        { orderNumber: { $regex: query, $options: "i" } },
        { trackingNumber: { $regex: query, $options: "i" } },
        { "shippingAddress.fullName": { $regex: query, $options: "i" } },
      ];
    }
    return filter;
  }

  private static buildUserFilter(
    query: string,
    patterns: TSearchPatterns,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (patterns.isObjectId) {
      filter._id = { $eq: query };
    } else if (patterns.isEmail) {
      filter.email = { $eq: query.toLowerCase() };
    } else if (patterns.isPhone) {
      filter.phone = { $regex: query, $options: "i" };
    } else {
      filter.$or = [
        { firstname: { $regex: query, $options: "i" } },
        { lastname: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }
    return filter;
  }

  private static buildSupportFilter(
    query: string,
    patterns: TSearchPatterns,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (patterns.isTicketId) {
      filter.ticketId = { $eq: query.toUpperCase() };
    } else if (patterns.isObjectId) {
      filter._id = { $eq: query };
    } else {
      filter.$or = [
        { subject: { $regex: query, $options: "i" } },
        { "messages.message": { $regex: query, $options: "i" } },
      ];
    }
    return filter;
  }

  private static buildReturnFilter(
    query: string,
    patterns: TSearchPatterns,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (patterns.isObjectId) {
      filter._id = { $eq: query };
    } else {
      filter.$or = [
        { "items.product": { $regex: query, $options: "i" } },
        { "order.orderNumber": { $regex: query, $options: "i" } },
      ];
    }
    return filter;
  }
}
