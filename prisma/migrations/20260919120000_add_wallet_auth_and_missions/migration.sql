CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'discovery',
    "target" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "WalletUser" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "WalletChallenge" (
    "id" TEXT NOT NULL,
    "walletUserId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WalletSession" (
    "id" TEXT NOT NULL,
    "walletUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletUserId" TEXT,
    "missionId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "proofSignature" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "WalletAchievement" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletUserId" TEXT,
    "achievementId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Mission_slug_key" ON "Mission"("slug");
CREATE INDEX "Mission_isActive_category_idx" ON "Mission"("isActive", "category");
CREATE UNIQUE INDEX "WalletUser_walletAddress_key" ON "WalletUser"("walletAddress");
CREATE UNIQUE INDEX "WalletChallenge_nonce_key" ON "WalletChallenge"("nonce");
CREATE INDEX "WalletChallenge_walletUserId_idx" ON "WalletChallenge"("walletUserId");
CREATE INDEX "WalletChallenge_expiresAt_idx" ON "WalletChallenge"("expiresAt");
CREATE UNIQUE INDEX "WalletSession_tokenHash_key" ON "WalletSession"("tokenHash");
CREATE INDEX "WalletSession_walletUserId_idx" ON "WalletSession"("walletUserId");
CREATE INDEX "WalletSession_expiresAt_idx" ON "WalletSession"("expiresAt");
CREATE UNIQUE INDEX "MissionProgress_walletAddress_missionId_key" ON "MissionProgress"("walletAddress", "missionId");
CREATE INDEX "MissionProgress_walletAddress_idx" ON "MissionProgress"("walletAddress");
CREATE INDEX "MissionProgress_completedAt_idx" ON "MissionProgress"("completedAt");
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");
CREATE UNIQUE INDEX "WalletAchievement_walletAddress_achievementId_key" ON "WalletAchievement"("walletAddress", "achievementId");

ALTER TABLE "WalletChallenge" ADD CONSTRAINT "WalletChallenge_walletUserId_fkey" FOREIGN KEY ("walletUserId") REFERENCES "WalletUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletSession" ADD CONSTRAINT "WalletSession_walletUserId_fkey" FOREIGN KEY ("walletUserId") REFERENCES "WalletUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_walletUserId_fkey" FOREIGN KEY ("walletUserId") REFERENCES "WalletUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletAchievement" ADD CONSTRAINT "WalletAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletAchievement" ADD CONSTRAINT "WalletAchievement_walletUserId_fkey" FOREIGN KEY ("walletUserId") REFERENCES "WalletUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
