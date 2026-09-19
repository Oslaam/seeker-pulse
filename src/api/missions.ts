import type { ApiResponse } from "../api.js";
import { prisma } from "../lib/db.js";
import { requireWalletSession } from "./auth.js";
import { fetchActivity } from "../lib/activity.js";
import { detectDappsFromActivity } from "../lib/dapps/detected.js";
import { readSkrBalance } from "./wallet.js";
import { buildJourneySummary } from "../lib/exploration.js";

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

const HELIUS_API_KEY = process.env.HELIUS_API_KEY?.trim();

const DAILY_MISSIONS = [
  { slug: "explore-dapp", title: "Explore a verified dApp", description: "Use a verified dApp naturally and let Pulse detect the activity.", kind: "dapp_activity", category: "discovery", target: 1, xp: 20 },
  { slug: "daily-activity", title: "Complete an on-chain activity", description: "Complete a real wallet action today. Opening Pulse does not count.", kind: "onchain_activity", category: "activity", target: 1, xp: 20 },
] as const;

async function syncVerifiedProgress(walletUserId: string, walletAddress: string): Promise<void> {
  if (!HELIUS_API_KEY) return;
  const activity = await fetchActivity(walletAddress, HELIUS_API_KEY);
  const detectedDapps = await detectDappsFromActivity(activity.topSources).catch(() => []);
  const skrBalance = await readSkrBalance(walletAddress).catch(() => 0);
  const now = new Date();
  const values = new Map<string, number>([
    ["explore-dapp", detectedDapps.length > 0 ? 1 : 0],
    ["daily-activity", activity.todayCount > 0 ? 1 : 0],
  ]);

  for (const definition of DAILY_MISSIONS) {
    const mission = await prisma.mission.upsert({
      where: { slug: definition.slug },
      update: { title: definition.title, description: definition.description, target: definition.target, xp: definition.xp, isActive: true },
      create: definition,
    });
    const progress = values.get(definition.slug) ?? 0;
    const completed = progress >= mission.target;
    await prisma.missionProgress.upsert({
      where: { walletAddress_missionId: { walletAddress, missionId: mission.id } },
      update: { walletUserId, progress, completedAt: completed ? now : null, lastVerifiedAt: now },
      create: { walletAddress, walletUserId, missionId: mission.id, progress, completedAt: completed ? now : null, lastVerifiedAt: now },
    });
  }

  const achievements = [
    { slug: "first-pulse", title: "First Pulse", description: "Recorded your first verified wallet activity with Pulse.", kind: "onchain_activity", earned: activity.activeDays > 0 },
    { slug: "explorer", title: "Explorer", description: "Used a verified dApp detected by Pulse.", kind: "dapp_activity", earned: detectedDapps.length > 0 },
    { slug: "skr-native", title: "SKR Native", description: "Held a positive SKR balance in your connected wallet.", kind: "skr_balance", earned: skrBalance > 0 },
    { slug: "three-day-pulse", title: "3-Day Pulse", description: "Maintained three consecutive days of wallet activity.", kind: "streak", earned: activity.streak >= 3 },
    { slug: "seven-day-pulse", title: "7-Day Pulse", description: "Maintained seven consecutive days of wallet activity.", kind: "streak", earned: activity.streak >= 7 },
    { slug: "power-user", title: "Power User", description: "Built a seven-day streak across at least four protocols.", kind: "power_user", earned: activity.streak >= 7 && activity.uniqueDapps >= 4 },
  ];
  for (const definition of achievements.filter((achievement) => achievement.earned)) {
    const achievement = await prisma.achievement.upsert({
      where: { slug: definition.slug },
      update: { title: definition.title, description: definition.description, isActive: true },
      create: { slug: definition.slug, title: definition.title, description: definition.description, kind: definition.kind },
    });
    await prisma.walletAchievement.upsert({
      where: { walletAddress_achievementId: { walletAddress, achievementId: achievement.id } },
      update: { walletUserId },
      create: { walletAddress, walletUserId, achievementId: achievement.id },
    });
  }
}

export async function getMissionState(request: RequestLike, response: ApiResponse): Promise<void> {
  const session = await requireWalletSession(request);
  if (!session) {
    response.status(401).json({ error: "A verified wallet session is required." });
    return;
  }
  try {
    await syncVerifiedProgress(session.id, session.walletAddress);
  } catch {
    // Keep the authenticated dashboard available if the activity provider is temporarily unavailable.
  }
  const [missions, achievements, interactions] = await Promise.all([
    prisma.mission.findMany({ where: { isActive: true }, include: { progress: { where: { walletUserId: session.id } } }, orderBy: { createdAt: "asc" } }),
    prisma.walletAchievement.findMany({ where: { walletUserId: session.id }, include: { achievement: true }, orderBy: { awardedAt: "desc" } }),
    prisma.walletDappInteraction.findMany({
      where: { walletUserId: session.id },
      include: { dapp: { include: { categories: { include: { category: true } } } } },
      orderBy: { lastOpenedAt: "desc" },
    }),
  ]);

  const journey = buildJourneySummary(
    interactions.map((interaction) => ({
      dappId: interaction.dappId,
      dappName: interaction.dapp.name,
      category: interaction.dapp.categories[0]?.category.slug ?? "exploration",
      firstOpenedAt: interaction.firstOpenedAt.toISOString(),
      lastOpenedAt: interaction.lastOpenedAt.toISOString(),
      openCount: interaction.openCount,
    })),
    new Date().toISOString(),
  );

  response.json({
    missions: missions.map((mission) => ({ id: mission.id, slug: mission.slug, title: mission.title, description: mission.description, target: mission.target, xp: mission.xp, progress: mission.progress[0]?.progress ?? 0, completedAt: mission.progress[0]?.completedAt ?? null })),
    achievements: achievements.map((award) => ({ slug: award.achievement.slug, title: award.achievement.title, description: award.achievement.description, awardedAt: award.awardedAt })),
    journey,
  });
}

export async function recordDappExploration(request: RequestLike, response: ApiResponse): Promise<void> {
  const session = await requireWalletSession(request);
  if (!session) {
    response.status(401).json({ error: "A verified wallet session is required." });
    return;
  }

  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const dappId = typeof body.dappId === "string" ? body.dappId.trim() : "";
  if (!dappId) {
    response.status(400).json({ error: "A verified dApp id is required." });
    return;
  }

  try {
    const dapp = await prisma.dapp.findUnique({ where: { id: dappId }, include: { categories: { include: { category: true } } } });
    if (!dapp) {
      response.status(404).json({ error: "That dApp is not in the verified catalog." });
      return;
    }

    const record = await prisma.walletDappInteraction.upsert({
      where: { walletUserId_dappId: { walletUserId: session.id, dappId } },
      update: {
        lastOpenedAt: new Date(),
        openCount: { increment: 1 },
      },
      create: {
        walletUserId: session.id,
        dappId,
        firstOpenedAt: new Date(),
        lastOpenedAt: new Date(),
        openCount: 1,
      },
    });

    response.json({
      dappId: record.dappId,
      openCount: record.openCount,
      firstOpenedAt: record.firstOpenedAt,
      lastOpenedAt: record.lastOpenedAt,
      category: dapp.categories[0]?.category.slug ?? "exploration",
    });
  } catch {
    response.status(503).json({ error: "The exploration tracker is temporarily unavailable." });
  }
}
