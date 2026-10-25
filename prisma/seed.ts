/**
 * Idempotent demo seed. Safe to run repeatedly: every record is upserted on a stable natural key
 * and existing rows are never overwritten, so admin edits survive a re-seed.
 *
 * All phone numbers are TEST DATA. US/CA use the reserved 555-01xx block, GB uses Ofcom's drama
 * range (07700 900xxx), DE uses Berlin 030 23125 xxx and FR uses ARCEP's fictional 06 39 98 xx xx.
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { PAYMENT_METHODS } from "../src/lib/payment-methods";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "../src/generated/prisma/enums";

const ADMIN_EMAIL = "admin@vnum.test";
const DEMO_EMAIL = "demo@vnum.test";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin#Demo2025";
const demoPassword = process.env.SEED_DEMO_PASSWORD || "Demo#Pass2025";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20251024);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const daysAgo = (d: number, hours = 0) => new Date(Date.now() - d * 86_400_000 - hours * 3_600_000);

const SERVICES = [
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"],
  ["google", "Google"],
  ["discord", "Discord"],
  ["microsoft", "Microsoft"],
  ["amazon", "Amazon"],
  ["uber", "Uber"],
  ["signal", "Signal"],
  ["generic-otp", "Generic OTP"],
] as const;

type Country = {
  code: string;
  name: string;
  count: number;
  price: [number, number];
  regions: readonly string[] | null;
  make: (i: number, region: number) => string;
};

const COUNTRIES: Country[] = [
  {
    code: "US", name: "United States", count: 16, price: [150, 450],
    regions: ["New York", "San Francisco", "Miami", "Austin", "Seattle", "Chicago"],
    make: (i, r) => `+1${[212, 415, 305, 512, 206, 312][r]}55501${pad(i * 5 + 3, 2)}`,
  },
  {
    code: "CA", name: "Canada", count: 12, price: [180, 420],
    regions: ["Toronto", "Vancouver", "Montreal"],
    make: (i, r) => `+1${[416, 604, 514][r]}55501${pad(i * 7 + 4, 2)}`,
  },
  {
    code: "GB", name: "United Kingdom", count: 14, price: [220, 620], regions: null,
    make: (i) => `+447700900${pad(i * 37 + 11, 3)}`,
  },
  {
    code: "DE", name: "Germany", count: 12, price: [260, 720], regions: ["Berlin"],
    make: (i) => `+493023125${pad(i * 41 + 7, 3)}`,
  },
  {
    code: "FR", name: "France", count: 12, price: [250, 660], regions: null,
    make: (i) => `+3363998${pad(i * 53 + 9, 4)}`,
  },
];

async function seedUsers() {
  const [adminHash, demoHash] = await Promise.all([hashPassword(adminPassword), hashPassword(demoPassword)]);
  const users = [
    { email: ADMIN_EMAIL, name: "Avery Admin", role: "ADMIN" as const, status: "ACTIVE" as const, hash: adminHash, age: 60 },
    { email: DEMO_EMAIL, name: "Dana Demo", role: "USER" as const, status: "ACTIVE" as const, hash: demoHash, age: 30 },
    { email: "priya.nair@vnum.test", name: "Priya Nair", role: "USER" as const, status: "ACTIVE" as const, hash: demoHash, age: 21 },
    { email: "tomas.berg@vnum.test", name: "Tomas Berg", role: "USER" as const, status: "ACTIVE" as const, hash: demoHash, age: 14 },
    { email: "lena.okafor@vnum.test", name: "Lena Okafor", role: "USER" as const, status: "SUSPENDED" as const, hash: demoHash, age: 9 },
    { email: "sam.whitfield@vnum.test", name: "Sam Whitfield", role: "USER" as const, status: "ACTIVE" as const, hash: demoHash, age: 3 },
  ];
  const out: Record<string, string> = {};
  for (const u of users) {
    const row = await db.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, status: u.status, passwordHash: u.hash, createdAt: daysAgo(u.age) },
      update: {},
    });
    out[u.email] = row.id;
  }
  return out;
}

async function seedInventory() {
  const serviceIds: Record<string, string> = {};
  for (const [slug, name] of SERVICES) {
    const s = await db.service.upsert({ where: { slug }, create: { slug, name }, update: {} });
    serviceIds[slug] = s.id;
  }
  const numbers: Record<string, string> = {};
  for (const c of COUNTRIES) {
    for (let i = 0; i < c.count; i++) {
      const regionIdx = c.regions ? i % c.regions.length : 0;
      const e164 = c.make(i, regionIdx);
      const priceCents = Math.round(between(c.price[0], c.price[1]) / 5) * 5;
      const svc = new Set<string>(["generic-otp"]);
      const n = between(2, 5);
      while (svc.size < n) svc.add(pick(SERVICES)[0]);
      const status = i === c.count - 1 && c.code !== "US" ? "DISABLED" : "AVAILABLE";
      const row = await db.virtualNumber.upsert({
        where: { e164 },
        create: {
          e164, countryCode: c.code, countryName: c.name, region: c.regions ? c.regions[regionIdx] : null,
          priceCents, status, smsInbound: true, voice: rand() > 0.8, provider: "demo", createdAt: daysAgo(between(1, 40)),
          services: { create: [...svc].map((slug) => ({ serviceId: serviceIds[slug] })) },
        },
        update: {},
      });
      numbers[e164] = row.id;
    }
  }
  return numbers;
}

type SeedOrder = {
  ref: string; user: string; numberIdx: number; status: OrderStatus; age: number;
  payment?: { status: PaymentStatus; method: PaymentMethod; reason?: string };
};

async function seedOrders(users: Record<string, string>) {
  const available = await db.virtualNumber.findMany({
    where: { provider: "demo", status: "AVAILABLE" },
    orderBy: { e164: "asc" },
  });
  const plan: SeedOrder[] = [
    { ref: "VN-DEMO01", user: DEMO_EMAIL, numberIdx: 1, status: "COMPLETED", age: 12, payment: { status: "CONFIRMED", method: "USDT_TRC20_SIM" } },
    { ref: "VN-DEMO02", user: DEMO_EMAIL, numberIdx: 9, status: "COMPLETED", age: 6, payment: { status: "CONFIRMED", method: "BTC_SIM" } },
    { ref: "VN-DEMO03", user: DEMO_EMAIL, numberIdx: 20, status: "CANCELLED", age: 4, payment: { status: "EXPIRED", method: "USDT_ERC20_SIM", reason: "Payment window expired" } },
    { ref: "VN-DEMO04", user: DEMO_EMAIL, numberIdx: 31, status: "FAILED", age: 2, payment: { status: "FAILED", method: "BTC_SIM", reason: "Underpaid: received 0.00001500 BTC, expected 0.00003000 BTC" } },
    { ref: "VN-PRIY01", user: "priya.nair@vnum.test", numberIdx: 4, status: "COMPLETED", age: 8, payment: { status: "CONFIRMED", method: "USDT_TRC20_SIM" } },
    { ref: "VN-PRIY02", user: "priya.nair@vnum.test", numberIdx: 15, status: "PAID_SANDBOX", age: 0.2, payment: { status: "CONFIRMED", method: "USDT_ERC20_SIM" } },
    { ref: "VN-TOMA01", user: "tomas.berg@vnum.test", numberIdx: 26, status: "PROCESSING", age: 0.1, payment: { status: "CONFIRMED", method: "BTC_SIM" } },
    { ref: "VN-TOMA02", user: "tomas.berg@vnum.test", numberIdx: 36, status: "COMPLETED", age: 5, payment: { status: "CONFIRMED", method: "USDT_TRC20_SIM" } },
    { ref: "VN-SAMW01", user: "sam.whitfield@vnum.test", numberIdx: 43, status: "FAILED", age: 1, payment: { status: "FAILED", method: "USDT_TRC20_SIM", reason: "Simulated network failure" } },
  ];
  for (const o of plan) {
    const number = available[o.numberIdx];
    const created = new Date(Date.now() - o.age * 86_400_000);
    const order = await db.order.upsert({
      where: { reference: o.ref },
      create: {
        reference: o.ref, userId: users[o.user], numberId: number.id, status: o.status,
        amountCents: number.priceCents, idempotencyKey: `seed-${o.ref}`,
        expiresAt: new Date(created.getTime() + 15 * 60_000),
        completedAt: o.status === "COMPLETED" ? new Date(created.getTime() + 60_000) : null,
        createdAt: created,
      },
      update: {},
    });
    // Keep inventory consistent with the seeded order state (only on first creation).
    if (order.createdAt.getTime() === created.getTime()) {
      const inventoryStatus = ["COMPLETED", "PAID_SANDBOX", "PROCESSING"].includes(o.status) ? "SOLD" : null;
      if (inventoryStatus) await db.virtualNumber.updateMany({ where: { id: number.id, status: "AVAILABLE" }, data: { status: inventoryStatus } });
    }
    if (o.payment) {
      const info = PAYMENT_METHODS[o.payment.method];
      const cryptoAmount = (number.priceCents / 100 / info.rateUsd).toFixed(info.decimals);
      await db.payment.upsert({
        where: { reference: `PAY-${o.ref.slice(3)}` },
        create: {
          reference: `PAY-${o.ref.slice(3)}`, orderId: order.id, method: o.payment.method, status: o.payment.status,
          amountCents: number.priceCents, cryptoAmount, cryptoSymbol: info.symbol,
          depositAddress: `SIM-${o.ref.replace("-", "").toLowerCase().padEnd(32, "0")}`,
          failureReason: o.payment.reason ?? null, expiresAt: new Date(created.getTime() + 15 * 60_000),
          confirmedAt: o.payment.status === "CONFIRMED" ? new Date(created.getTime() + 45_000) : null, createdAt: created,
        },
        update: {},
      });
    }
    await db.activityLog.upsert({
      where: { id: `seed_act_${o.ref}` },
      create: {
        id: `seed_act_${o.ref}`, actorId: users[o.user], action: `order.${o.status.toLowerCase()}`,
        entityType: "Order", entityId: order.id, metadata: { number: number.e164, seeded: true }, createdAt: created,
      },
      update: {},
    });
  }
}

async function seedMessages(users: Record<string, string>) {
  const order = await db.order.findUniqueOrThrow({ where: { reference: "VN-DEMO02" }, include: { number: true } });
  const demo = users[DEMO_EMAIL];
  const rows = [
    { id: "seed_msg_1", direction: "INBOUND" as const, from: "VNUM-DEMO", to: order.number.e164, body: "Your VNum demo verification code is 482913. This is a simulated message.", status: "DELIVERED" as const, age: 0.5 },
  ];
  for (const m of rows) {
    const at = new Date(Date.now() - m.age * 86_400_000);
    await db.message.upsert({
      where: { id: m.id },
      create: {
        id: m.id, userId: demo, numberId: order.numberId, orderId: order.id, direction: m.direction,
        fromAddress: m.from, toAddress: m.to, body: m.body, status: m.status,
        commandStatus: "SIMULATED_DELIVER_SM",
        smppMessageId: `sim-seed${m.id.slice(-1)}`,
        deliveredAt: at, createdAt: at,
      },
      update: {},
    });
  }
}

async function main() {
  const users = await seedUsers();
  await seedInventory();
  await seedOrders(users);
  await seedMessages(users);
  const [u, n, o] = await Promise.all([db.user.count(), db.virtualNumber.count(), db.order.count()]);
  console.log(`Seed complete: ${u} users, ${n} numbers, ${o} orders.`);
  console.log(`  admin: ${ADMIN_EMAIL}   customer: ${DEMO_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
