-- CreateEnum
CREATE TYPE "SmppLinkState" AS ENUM ('DISABLED', 'CONNECTING', 'BOUND', 'FAILED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "SmppVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "systemId" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "systemType" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reconnectRequestedAt" TIMESTAMP(3),
    "linkState" "SmppLinkState" NOT NULL DEFAULT 'DISABLED',
    "lastError" TEXT,
    "lastBoundAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmppVendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmppVendor_name_key" ON "SmppVendor"("name");

-- CreateIndex
CREATE INDEX "Message_vendorId_idx" ON "Message"("vendorId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "SmppVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
