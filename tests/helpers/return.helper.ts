import { request } from "./request.helper";
import { ReturnStatus } from "@modules/returns/interfaces/return.interface";
import { ReturnModel } from "@modules/returns/return.model";

/**
 * Initiates a return via the HTTP API.
 */
export async function initiateReturn(
  accessToken: string,
  orderId: string,
  payload: { items: unknown[]; images?: string[] },
) {
  return request
    .post(`/api/v1/returns/${orderId}/initiate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(payload);
}

/**
 * Admin approves or rejects a pending return.
 */
export async function arbitrateReturn(
  adminToken: string,
  returnId: string,
  status: ReturnStatus.APPROVED | ReturnStatus.REJECTED,
  rejectionReason?: string,
) {
  const body: Record<string, unknown> = { status };
  if (rejectionReason !== undefined) {
    body.adminRejectionReason = rejectionReason;
  }
  return request
    .patch(`/api/v1/returns/admin/${returnId}/arbitrate`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(body);
}

/**
 * Admin processes refund + restock.
 */
export async function processRefund(adminToken: string, returnId: string) {
  return request
    .post(`/api/v1/returns/admin/${returnId}/process`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({});
}

/**
 * Direct DB fetch — useful for asserting stored state.
 */
export async function findReturnById(returnId: string) {
  return ReturnModel.findById(returnId);
}