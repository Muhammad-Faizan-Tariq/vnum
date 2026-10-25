import type { OrderStatus } from "@/generated/prisma/enums";

/** Explicit order state machine. Every status change on the server goes through canTransition. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID_SANDBOX", "CANCELLED", "FAILED"],
  PAID_SANDBOX: ["PROCESSING", "CANCELLED", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Statuses after which the number goes back into inventory. */
export const RELEASING_STATUSES: readonly OrderStatus[] = ["CANCELLED", "FAILED"];

export const LIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID_SANDBOX",
  "PROCESSING",
];
