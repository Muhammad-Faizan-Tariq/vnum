import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const PAGE_SIZE = 12;

const optionalText = z
  .string()
  .trim()
  .max(60)
  .optional()
  .transform((v) => (v ? v : undefined));

const price = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().min(0).max(10000).optional().catch(undefined),
);

export const numberFiltersSchema = z.object({
  q: optionalText,
  country: optionalText,
  service: optionalText,
  status: z.enum(["AVAILABLE", "RESERVED"]).optional().catch(undefined),
  minPrice: price,
  maxPrice: price,
  sort: z.enum(["price_asc", "price_desc", "newest", "country"]).default("price_asc").catch("price_asc"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});
export type NumberFilters = z.infer<typeof numberFiltersSchema>;

export function parseNumberFilters(sp: Record<string, string | string[] | undefined>): NumberFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return numberFiltersSchema.parse(flat);
}

function where(f: NumberFilters): Prisma.VirtualNumberWhereInput {
  const and: Prisma.VirtualNumberWhereInput[] = [
    { status: f.status ? f.status : { in: ["AVAILABLE", "RESERVED"] } },
  ];
  if (f.country) and.push({ countryCode: f.country.toUpperCase() });
  if (f.service) and.push({ services: { some: { service: { slug: f.service } } } });
  if (f.minPrice !== undefined) and.push({ priceCents: { gte: Math.round(f.minPrice * 100) } });
  if (f.maxPrice !== undefined) and.push({ priceCents: { lte: Math.round(f.maxPrice * 100) } });
  if (f.q) {
    const digits = f.q.replace(/[^\d]/g, "");
    and.push({
      OR: [
        ...(digits.length >= 2 ? [{ e164: { contains: digits } }] : []),
        { countryName: { contains: f.q, mode: "insensitive" as const } },
        { countryCode: { equals: f.q.toUpperCase() } },
        { services: { some: { service: { name: { contains: f.q, mode: "insensitive" as const } } } } },
      ],
    });
  }
  return { AND: and };
}

const ORDER_BY: Record<NumberFilters["sort"], Prisma.VirtualNumberOrderByWithRelationInput[]> = {
  price_asc: [{ priceCents: "asc" }, { e164: "asc" }],
  price_desc: [{ priceCents: "desc" }, { e164: "asc" }],
  newest: [{ createdAt: "desc" }, { e164: "asc" }],
  country: [{ countryName: "asc" }, { priceCents: "asc" }],
};

export async function searchNumbers(f: NumberFilters) {
  const w = where(f);
  const [total, items] = await Promise.all([
    db.virtualNumber.count({ where: w }),
    db.virtualNumber.findMany({
      where: w,
      orderBy: ORDER_BY[f.sort],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { services: { include: { service: true } } },
    }),
  ]);
  return { total, items, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function filterOptions() {
  const [countries, services] = await Promise.all([
    db.virtualNumber.groupBy({
      by: ["countryCode", "countryName"],
      where: { status: { in: ["AVAILABLE", "RESERVED"] } },
      orderBy: { countryName: "asc" },
    }),
    db.service.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { countries, services };
}
