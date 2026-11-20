-- CreateEnum
CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "assignedUserId" UUID,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completionReport" VARCHAR(6000),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "statusKey" VARCHAR(36) NOT NULL DEFAULT 'open';

-- CreateTable
CREATE TABLE "WorkStatus" (
    "organizationId" UUID NOT NULL,
    "key" VARCHAR(36) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "terminal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkStatus_pkey" PRIMARY KEY ("organizationId","key")
);

-- CreateTable
CREATE TABLE "WorkTask" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateTable
CREATE TABLE "WorkAttachment" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAttachment_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkStatus_organizationId_label_key" ON "WorkStatus"("organizationId", "label");

-- CreateIndex
CREATE INDEX "WorkTask_organizationId_orderId_createdAt_idx" ON "WorkTask"("organizationId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkAttachment_organizationId_orderId_idx" ON "WorkAttachment"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_statusKey_dueAt_idx" ON "WorkOrder"("organizationId", "statusKey", "dueAt");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_assignedUserId_idx" ON "WorkOrder"("organizationId", "assignedUserId");

-- AddForeignKey
-- Seed each existing organization before enforcing status references.
INSERT INTO "WorkStatus" ("organizationId", "key", "label", "terminal")
SELECT organization.id, status.key, status.label, status.terminal
FROM "Organization" AS organization
CROSS JOIN (VALUES
  ('open', 'Aberta', false),
  ('in-progress', 'Em andamento', false),
  ('completed', 'Concluída', true)
) AS status(key, label, terminal);

-- Preserve the origin in the history of orders converted before this migration.
INSERT INTO "AuditEvent" ("id", "organizationId", "actorId", "action", "entity", "entityId", "details", "createdAt")
SELECT gen_random_uuid(), "organizationId", "createdBy", 'order.from_quote', 'work_order', "id",
       jsonb_build_object('quoteId', "quoteId"), "createdAt"
FROM "WorkOrder"
WHERE "quoteId" IS NOT NULL;

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_statusKey_fkey" FOREIGN KEY ("organizationId", "statusKey") REFERENCES "WorkStatus"("organizationId", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_assignedUserId_fkey" FOREIGN KEY ("organizationId", "assignedUserId") REFERENCES "Membership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStatus" ADD CONSTRAINT "WorkStatus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_organizationId_orderId_fkey" FOREIGN KEY ("organizationId", "orderId") REFERENCES "WorkOrder"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAttachment" ADD CONSTRAINT "WorkAttachment_organizationId_orderId_fkey" FOREIGN KEY ("organizationId", "orderId") REFERENCES "WorkOrder"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
