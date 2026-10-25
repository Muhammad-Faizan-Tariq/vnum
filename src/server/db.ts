import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const { DATABASE_URL } = getEnv();
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 10 }) });
}

/** Single shared client (reused across hot reloads in development). */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    globalForPrisma.prisma ??= createClient();
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
