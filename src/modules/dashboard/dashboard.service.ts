import { Types } from "mongoose";
import logger from "@config/logger";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { DateRangeQueryInput } from "./dtos/date-range.dto";
import {
  IDashboardMetrics,
  ITopSellingProduct,
  IInventoryAlert,
} from "./interfaces/dashboard.interface";

// Mongoose Models
import { Order } from "@modules/orders/order.model";
import { Product } from "@modules/products/models/base-product.model";
import { User } from "@modules/users/user.model";
import { Ticket } from "@modules/support/support.model";
import { TicketStatus } from "@modules/support/interfaces/support.interface";

/**
 * Interface mapping the exact projection returned by the lean() inventory query.
 * Replaces the need for unsafe 'any' casting.
 */
interface ILeanProduct {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  currentStock: number;
}

/**
 * DASHBOARD SERVICE
 *
 * ARCHITECTURE NOTE:
 * This service is a Read-Heavy Mathematical Engine. It utilizes MongoDB
 * Aggregation Pipelines and $facet to perform complex groupings and summations
 * directly at the C++ storage layer, bypassing Node.js heap memory limits.
 */
export class DashboardService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * Prevents CRLF Log Injection attacks.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method getMetrics
   * @description Aggregates core business vitals across Orders, Products, and Users.
   */
  public static async getMetrics(
    query: DateRangeQueryInput,
  ): Promise<IDashboardMetrics> {
    try {
      // Establish the Temporal Boundary
      // If no dates are provided, default to a 30-day rolling window to prevent full collection scans.
      const rawEndDate = query.endDate || new Date();
      const rawStartDate =
        query.startDate ||
        new Date(new Date().setDate(rawEndDate.getDate() - 30));

      // TIMEZONE NEUTRALIZATION
      // Locks the boundaries to the absolute start and end of the day.
      // This prevents Docker UTC environments from shifting Indian sales data across midnight.
      const startDate = new Date(rawStartDate);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(rawEndDate);
      endDate.setUTCHours(23, 59, 59, 999);

      const dateMatchQuery = {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      };

      logger.info(
        this.safeLog(
          `[Dashboard] Generating metrics from ${startDate.toISOString()} to ${endDate.toISOString()}`,
        ),
      );

      // Parallel Execution Strategy
      // We fire the three distinct domain queries simultaneously to cut latency.
      const [
        orderAggregations,
        lowStockProducts,
        userStats,
        pendingSupportTickets,
      ] = await Promise.all([
        this.aggregateOrderData(dateMatchQuery),
        this.fetchInventoryAlerts(),
        this.aggregateUserMetrics(dateMatchQuery),
        Ticket.countDocuments({
          status: {
            $in: [TicketStatus.OPEN, TicketStatus.WAITING_ON_CUSTOMER],
          },
        }),
      ]);

      // Assemble and Format the Final Payload
      return {
        dateRange: {
          start: startDate,
          end: endDate,
        },
        financials: orderAggregations.financials,
        orderFulfillment: orderAggregations.fulfillment,
        topSellingProducts: orderAggregations.topProducts,
        inventoryAlerts: lowStockProducts,
        userMetrics: userStats,
        pendingSupportTickets,
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Aggregation failure";
      logger.error(
        this.safeLog(`[Dashboard API] Critical metrics failure: ${errMsg}`),
      );

      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to compute dashboard aggregations. Please contact engineering.",
      );
    }
  }

  /**
   * @method aggregateOrderData
   * @description Uses $facet to run 3 isolated pipelines on the Orders collection in a single pass.
   */
  private static async aggregateOrderData(
    dateMatchQuery: Record<string, unknown>,
  ) {
    const result = await Order.aggregate([
      // Stage 1: Filter the entire collection down to the requested date range
      { $match: dateMatchQuery },

      // Stage 2: The $facet operator branches the pipeline into 3 parallel computations
      {
        $facet: {
          // Branch A: Financial Totals (Only counts DELIVERED orders as realized revenue)
          financials: [
            { $match: { orderStatus: "DELIVERED" } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$pricing.totalAmount" },
                totalOrders: { $sum: 1 },
              },
            },
          ],

          // Branch B: State Machine Distribution
          fulfillment: [
            {
              $group: {
                _id: "$orderStatus",
                count: { $sum: 1 },
              },
            },
          ],

          // Branch C: Top Selling Products (Unwinds the cart arrays to rank individual items)
          topProducts: [
            { $match: { orderStatus: "DELIVERED" } },
            { $unwind: "$items" }, // Flattens the array so each item is a separate document
            {
              $group: {
                _id: "$items.product",
                totalSold: { $sum: "$items.quantity" },
                // Mathematically computes exact revenue derived from this specific item
                revenueGenerated: {
                  $sum: {
                    $multiply: ["$items.priceAtPurchase", "$items.quantity"],
                  },
                },
              },
            },
            { $sort: { totalSold: -1 } }, // Rank highest to lowest
            { $limit: 5 }, // Only take the top 5

            // JOIN: Lookup the actual product details using the _id we grouped by
            {
              $lookup: {
                from: "products", // The physical name of the MongoDB collection
                localField: "_id",
                foreignField: "_id",
                as: "productDoc",
              },
            },
            { $unwind: "$productDoc" },
            {
              $project: {
                _id: 0,
                productId: "$_id",
                sku: "$productDoc.sku",
                name: "$productDoc.name",
                totalSold: 1,
                revenueGenerated: 1,
              },
            },
          ],
        },
      },
    ]);

    // Format Branch A (Financials)
    const financialData = result[0].financials[0] || {
      totalRevenue: 0,
      totalOrders: 0,
    };
    const averageOrderValue =
      financialData.totalOrders > 0
        ? Math.round(financialData.totalRevenue / financialData.totalOrders)
        : 0;

    // Format Branch B (Fulfillment Array -> Key/Value Object)
    const fulfillmentMap: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURN_REQUESTED: 0,
      RETURNED: 0,
    };

    result[0].fulfillment.forEach((status: { _id: string; count: number }) => {
      if (status._id && fulfillmentMap[status._id] !== undefined) {
        fulfillmentMap[status._id] = status.count;
      }
    });

    return {
      financials: {
        totalRevenue: financialData.totalRevenue,
        totalOrders: financialData.totalOrders,
        averageOrderValue,
      },
      fulfillment: fulfillmentMap as IDashboardMetrics["orderFulfillment"],
      topProducts: result[0].topProducts as ITopSellingProduct[],
    };
  }

  /**
   * @method fetchInventoryAlerts
   * @description A fast, targeted read to find active products nearing stock depletion.
   */
  private static async fetchInventoryAlerts(): Promise<IInventoryAlert[]> {
    const lowStockThreshold = 10;

    // Explicitly casting the .lean() output to our custom interface to eradicate 'any' usage
    const products = await Product.find({
      currentStock: { $lt: lowStockThreshold },
      isActive: true,
    })
      .select("sku name currentStock")
      .limit(10)
      .sort({ currentStock: 1 })
      .lean<ILeanProduct[]>();

    return products.map((p) => ({
      productId: String(p._id),
      sku: p.sku,
      name: p.name,
      currentStock: p.currentStock,
    }));
  }

  /**
   * @method aggregateUserMetrics
   * @description Computes the customer base growth.
   */
  private static async aggregateUserMetrics(
    dateMatchQuery: Record<string, unknown>,
  ) {
    const [totalRegisteredUsers, newSignupsInPeriod] = await Promise.all([
      User.countDocuments({ role: "USER" }),
      User.countDocuments({ role: "USER", ...dateMatchQuery }),
    ]);

    return {
      totalRegisteredUsers,
      newSignupsInPeriod,
    };
  }
}
