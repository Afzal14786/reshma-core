import { Types } from "mongoose";

/**
 * ARCHITECTURE NOTE:
 * We explicitly decouple the Dashboard interfaces from the specific MongoDB Models
 * (like IOrder or IProduct). The Dashboard is an aggregated, read-only view.
 * By defining strict independent interfaces here, we ensure that changes to the
 * underlying Order/Product schemas do not accidentally break the Dashboard UI contract.
 */

export interface ITopSellingProduct {
  productId: Types.ObjectId | string;
  sku: string;
  name: string;
  totalSold: number;
  revenueGenerated: number;
}

export interface IInventoryAlert {
  productId: Types.ObjectId | string;
  sku: string;
  name: string;
  currentStock: number;
}

export interface IDashboardMetrics {
  dateRange: {
    start: Date;
    end: Date;
  };
  financials: {
    totalRevenue: number;
    averageOrderValue: number;
    totalOrders: number;
  };
  orderFulfillment: {
    PENDING: number;
    PROCESSING: number;
    SHIPPED: number;
    DELIVERED: number;
    CANCELLED: number;
    RETURN_REQUESTED: number;
    RETURNED: number;
  };
  topSellingProducts: ITopSellingProduct[];
  inventoryAlerts: IInventoryAlert[];
  userMetrics: {
    totalRegisteredUsers: number;
    newSignupsInPeriod: number;
  };
  pendingSupportTickets: number;
}
