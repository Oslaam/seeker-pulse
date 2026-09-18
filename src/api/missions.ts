import type { ApiResponse } from "../api.js";
import { prisma } from "../lib/db.js";
import { requireWalletSession } from "./auth.js";

interface RequestLike { headers?: Record<string, string | string[] | undefined>; }

export async function getMissionState(request: RequestLike, response: ApiResponse): Promise<void> {
  const session = await requireWalletSession(request);
  if (!session) {
    response.status(401).json({ error: "A verified wallet session is required." });
    return;
  }
  const [missions, achievements] = await Promise.all([
    prisma.mission.findMany({ where: { isActive: true }, include: { progress: { where: { walletUserId: session.id } } }, orderBy: { createdAt: "asc" } }),
    prisma.walletAchievement.findMany({ where: { walletUserId: session.id }, include: { achievement: true }, orderBy: { awardedAt: "desc" } }),
  ]);
  response.json({
    missions: missions.map((mission) => ({ id: mission.id, slug: mission.slug, title: mission.title, description: mission.description, target: mission.target, xp: mission.xp, progress: mission.progress[0]?.progress ?? 0, completedAt: mission.progress[0]?.completedAt ?? null })),
    achievements: achievements.map((award) => ({ slug: award.achievement.slug, title: award.achievement.title, description: award.achievement.description, awardedAt: award.awardedAt })),
  });
}
