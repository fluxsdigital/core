-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "organizationId" UUID NOT NULL,
    "displayName" VARCHAR(150),
    "accentColor" CHAR(7) NOT NULL DEFAULT '#174877',
    "directoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quotesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ordersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
