/**
 * Strict Email Job Typings
 * * ARCHITECTURE NOTE:
 * We use TypeScript Discriminated Unions to guarantee payload accuracy.
 * If the worker picks up an 'ORDER_CONFIRMATION' job, TypeScript strictly enforces
 * that 'orderId' and 'totalAmount' must exist in the payload data.
 */

export type EmailJobType =
  | "OTP_VERIFICATION"
  | "WELCOME_EMAIL"
  | "PASSWORD_RESET"
  | "PROFILE_UPDATE"
  | "ORDER_CONFIRMATION"
  | "ORDER_CANCELLED"
  | "ORDER_SHIPPED";

interface BaseEmailJob {
  type: EmailJobType;
  to: string;
}

export interface IOtpVerificationJob extends BaseEmailJob {
  type: "OTP_VERIFICATION";
  data: { firstname: string; otp: string };
}

export interface IWelcomeEmailJob extends BaseEmailJob {
  type: "WELCOME_EMAIL";
  data: { firstname: string };
}

export interface IPasswordResetJob extends BaseEmailJob {
  type: "PASSWORD_RESET";
  data: { firstname: string; resetToken: string };
}

export interface IProfileUpdateJob extends BaseEmailJob {
  type: "PROFILE_UPDATE";
  data: { firstname: string; changedField: string; time: string };
}

export interface IOrderConfirmationJob extends BaseEmailJob {
  type: "ORDER_CONFIRMATION";
  data: { firstname: string; orderNumber: string; totalAmount: number };
}

export interface IOrderCancelledJob extends BaseEmailJob {
  type: "ORDER_CANCELLED";
  data: { firstname: string; orderNumber: string; reason: string };
}

export interface IOrderShippedJob extends BaseEmailJob {
  type: "ORDER_SHIPPED";
  data: {
    firstname: string;
    orderNumber: string;
    trackingNumber: string;
    courierName: string;
  };
}

// The exported union ensures our worker's exhaustive switch statement is flawless
export type EmailJobPayload =
  | IOtpVerificationJob
  | IWelcomeEmailJob
  | IPasswordResetJob
  | IProfileUpdateJob
  | IOrderConfirmationJob
  | IOrderCancelledJob
  | IOrderShippedJob;
