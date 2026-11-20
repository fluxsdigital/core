-- CreateEnum
CREATE TYPE "DirectoryKind" AS ENUM ('CUSTOMER', 'CONTACT', 'PRODUCT', 'SERVICE', 'CATEGORY');

-- CreateTable
CREATE TABLE "DirectoryRecord" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "kind" "DirectoryKind" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "code" VARCHAR(80),
    "description" VARCHAR(1500),
    "priceCents" INTEGER,
    "parentId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryRecord_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateTable
CREATE TABLE "DirectoryNote" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "content" VARCHAR(3000) NOT NULL,
    "authorId" UUID NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryNote_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateTable
CREATE TABLE "DirectoryAttachment" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "mediaType" VARCHAR(100) NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "authorId" UUID NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectoryAttachment_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateIndex
CREATE INDEX "DirectoryRecord_organizationId_kind_archivedAt_name_id_idx" ON "DirectoryRecord"("organizationId", "kind", "archivedAt", "name", "id");

-- CreateIndex
CREATE INDEX "DirectoryRecord_organizationId_parentId_idx" ON "DirectoryRecord"("organizationId", "parentId");

-- CreateIndex
CREATE INDEX "DirectoryNote_organizationId_recordId_archivedAt_createdAt_idx" ON "DirectoryNote"("organizationId", "recordId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "DirectoryAttachment_organizationId_recordId_archivedAt_crea_idx" ON "DirectoryAttachment"("organizationId", "recordId", "archivedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "DirectoryRecord" ADD CONSTRAINT "DirectoryRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryRecord" ADD CONSTRAINT "DirectoryRecord_organizationId_parentId_fkey" FOREIGN KEY ("organizationId", "parentId") REFERENCES "DirectoryRecord"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryNote" ADD CONSTRAINT "DirectoryNote_organizationId_recordId_fkey" FOREIGN KEY ("organizationId", "recordId") REFERENCES "DirectoryRecord"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryAttachment" ADD CONSTRAINT "DirectoryAttachment_organizationId_recordId_fkey" FOREIGN KEY ("organizationId", "recordId") REFERENCES "DirectoryRecord"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
