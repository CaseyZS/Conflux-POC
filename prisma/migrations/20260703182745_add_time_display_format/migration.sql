-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fromDetails" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultTaxRateBps" INTEGER NOT NULL DEFAULT 0,
    "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "invoiceFooter" TEXT,
    "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'INV-',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "timeDisplayFormat" TEXT NOT NULL DEFAULT 'hms',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Organization" ("createdAt", "defaultCurrency", "defaultPaymentTermsDays", "defaultTaxRateBps", "fromDetails", "id", "invoiceFooter", "invoiceNextNumber", "invoiceNumberPrefix", "name", "updatedAt") SELECT "createdAt", "defaultCurrency", "defaultPaymentTermsDays", "defaultTaxRateBps", "fromDetails", "id", "invoiceFooter", "invoiceNextNumber", "invoiceNumberPrefix", "name", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
