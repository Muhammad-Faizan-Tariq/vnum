import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { expireStaleOrders } from "@/server/orders/service";

export const ORDERS_PAGE_SIZE = 10;

export async function getOverview(userId: string) {
  await expireStaleOrders();
  const ownOrderIds = (await db.order.findMany({ where: { userId }, select: { id: true } })).map((o) => o.id);
  const [availableNumbers, activeOrders, completedOrders, pendingOrder, recentOrders, activity] = await Promise.all([
    db.virtualNumber.count({ where: { status: "AVAILABLE" } }),
    db.order.count({ where: { userId, status: { in: ["PENDING_PAYMENT", "PAID_SANDBOX", "PROCESSING"] } } }),
    db.order.count({ where: { userId, status: "COMPLETED" } }),
    db.order.findFirst({
      where: { userId, status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "desc" },
      include: { number: true },
    }),
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { number: true },
    }),
    db.activityLog.findMany({
      where: { OR: [{ actorId: userId }, { entityType: "Order", entityId: { in: ownOrderIds } }] },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  return { availableNumbers, activeOrders, completedOrders, pendingOrder, recentOrders, activity };
}

const ACTIVE = ["PENDING_PAYMENT", "PAID_SANDBOX", "PROCESSING"] as const;

export const orderFiltersSchema = z.object({
  view: z.enum(["all", "active", "completed", "closed"]).default("all").catch("all"),
  q: z.string().trim().max(40).optional().transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export function parseOrderFilters(sp: Record<string, string | string[] | undefined>) {
  return orderFiltersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
}

export async function listOrders(userId: string, f: OrderFilters) {
  await expireStaleOrders();
  const where: Prisma.OrderWhereInput = { userId };
  if (f.view === "active") where.status = { in: [...ACTIVE] };
  if (f.view === "completed") where.status = "COMPLETED";
  if (f.view === "closed") where.status = { in: ["CANCELLED", "FAILED"] };
  if (f.q) {
    const digits = f.q.replace(/[^\d]/g, "");
    where.OR = [
      { reference: { contains: f.q, mode: "insensitive" } },
      ...(digits.length >= 2 ? [{ number: { e164: { contains: digits } } }] : []),
      { number: { countryName: { contains: f.q, mode: "insensitive" as const } } },
    ];
  }
  const [total, items, counts] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: { number: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.order.groupBy({ by: ["status"], where: { userId }, _count: true }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const sum = (...s: string[]) => s.reduce((n, k) => n + (byStatus[k] ?? 0), 0);
  return {
    total,
    items,
    pages: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    tabs: {
      all: sum(...Object.keys(byStatus)),
      active: sum(...ACTIVE),
      completed: sum("COMPLETED"),
      closed: sum("CANCELLED", "FAILED"),
    },
  };
}

export async function getOrderDetail(userId: string, orderId: string) {
  await expireStaleOrders();
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      number: { include: { services: { include: { service: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return null;
  const timeline = await db.activityLog.findMany({
    where: { OR: [{ entityType: "Order", entityId: order.id }, { entityType: "Payment", entityId: { in: order.payments.map((p) => p.id) } }] },
    orderBy: { createdAt: "asc" },
  });
  return { order, timeline };
}

export const PAYMENTS_PAGE_SIZE = 10;

export async function listPayments(userId: string, status: string | undefined, page: number) {
  const where: Prisma.PaymentWhereInput = {
    order: { userId },
    ...(status && ["PENDING", "CONFIRMED", "EXPIRED", "FAILED", "CANCELLED"].includes(status)
      ? { status: status as "PENDING" }
      : {}),
  };
  const [total, items] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAYMENTS_PAGE_SIZE,
      take: PAYMENTS_PAGE_SIZE,
      include: { order: { include: { number: true } } },
    }),
  ]);
  return { total, items, pages: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)) };
}
