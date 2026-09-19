CREATE TABLE "WalletDappInteraction" (
    "id" TEXT NOT NULL,
    "walletUserId" TEXT NOT NULL,
    "dappId" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletDappInteraction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletDappInteraction_walletUserId_dappId_key"
    ON "WalletDappInteraction"("walletUserId", "dappId");

CREATE INDEX "WalletDappInteraction_walletUserId_lastOpenedAt_idx"
    ON "WalletDappInteraction"("walletUserId", "lastOpenedAt");

CREATE INDEX "WalletDappInteraction_walletUserId_openCount_idx"
    ON "WalletDappInteraction"("walletUserId", "openCount");

ALTER TABLE "WalletDappInteraction"
    ADD CONSTRAINT "WalletDappInteraction_walletUserId_fkey"
    FOREIGN KEY ("walletUserId") REFERENCES "WalletUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletDappInteraction"
    ADD CONSTRAINT "WalletDappInteraction_dappId_fkey"
    FOREIGN KEY ("dappId") REFERENCES "Dapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;