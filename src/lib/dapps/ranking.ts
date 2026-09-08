import type { DappRecord, DappSearchIntent } from "./types.js";

export function rankDappForPulse(dapp: {
  isActive?: boolean;
  isVerified?: boolean;
  isSeekerCompatible?: boolean;
  description?: string | null;
  shortDescription?: string | null;
  website?: string | null;
  packageName?: string | null;
  releases?: Array<{ releaseDate?: string | Date | null }>;
  rating?: number | null;
  reviewCount?: number | null;
}): number {
  let score = 0;

  if (dapp.isActive) score += 30;
  if (dapp.isVerified) score += 20;
  if (dapp.isSeekerCompatible) score += 20;

  const metadata = [dapp.description, dapp.shortDescription, dapp.website, dapp.packageName].filter(Boolean).length;
  score += Math.min(metadata * 8, 24);

  if (dapp.releases && dapp.releases.length > 0) {
    const latest = dapp.releases[dapp.releases.length - 1];
    const releaseDate = latest?.releaseDate ? new Date(latest.releaseDate) : null;
    if (releaseDate && !Number.isNaN(releaseDate.getTime())) {
      const ageDays = (Date.now() - releaseDate.getTime()) / 86400000;
      const freshness = Math.max(0, 100 - ageDays / 2);
      score += Math.min(freshness, 20) / 5;
    }
  }

  if (typeof dapp.rating === "number") score += Math.min(dapp.rating * 10, 20);
  if (typeof dapp.reviewCount === "number") score += Math.min(dapp.reviewCount / 20, 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildPulseScore(dapp: DappRecord | null | undefined): number | null {
  if (!dapp) return null;
  return rankDappForPulse({
    isActive: dapp.isActive,
    isVerified: dapp.isVerified,
    isSeekerCompatible: dapp.isSeekerCompatible,
    description: dapp.description,
    shortDescription: dapp.shortDescription,
    website: dapp.website,
    packageName: dapp.packageName,
    releases: dapp.releases,
    rating: dapp.rating,
    reviewCount: dapp.reviewCount,
  });
}

export function buildIntentSignals(intent: DappSearchIntent): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const key of intent.categories) weights[key] = 3;
  for (const keyword of intent.keywords) weights[keyword.toLowerCase()] = 2;
  return weights;
}
