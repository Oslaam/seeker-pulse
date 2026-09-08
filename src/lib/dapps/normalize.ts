import type { DiscoveredDapp, DiscoveredRelease } from "./types.js";

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePackageName(packageName: string | null | undefined): string | null {
  const normalized = normalizeText(packageName);
  if (!normalized) return null;
  return normalized.replace(/^\s+|\s+$/g, "");
}

function normalizeStatus(value: string | null | undefined): string {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return "unknown";
  if (["active", "inactive", "archived", "pending", "unknown"].includes(normalized)) return normalized;
  return "unknown";
}

function normalizeRelease(release: DiscoveredRelease | undefined): DiscoveredRelease | undefined {
  if (!release) return undefined;
  return {
    version: normalizeText(release.version) ?? "unknown",
    versionCode: normalizeText(release.versionCode) ?? undefined,
    packageName: normalizePackageName(release.packageName) ?? undefined,
    releaseDate: release.releaseDate ? new Date(release.releaseDate).toISOString() : undefined,
    metadataUrl: normalizeText(release.metadataUrl) ?? undefined,
    apkUrl: normalizeText(release.apkUrl) ?? undefined,
  };
}

export function normalizeDiscoveredDapp(input: DiscoveredDapp): DiscoveredDapp {
  const name = normalizeText(input.name);
  if (!name) throw new Error("Discovered dApp has no valid name.");

  return {
    source: normalizeText(input.source) ?? "unknown",
    sourceId: normalizeText(input.sourceId) ?? undefined,
    sourceUrl: normalizeText(input.sourceUrl) ?? undefined,
    metadataUri: normalizeText(input.metadataUri) ?? undefined,
    verifiedAt: input.verifiedAt ? new Date(input.verifiedAt).toISOString() : undefined,
    name,
    description: normalizeText(input.description) ?? undefined,
    shortDescription: normalizeText(input.shortDescription) ?? undefined,
    website: normalizeText(input.website) ?? undefined,
    iconUrl: normalizeText(input.iconUrl) ?? undefined,
    bannerUrl: normalizeText(input.bannerUrl) ?? undefined,
    packageName: normalizePackageName(input.packageName) ?? undefined,
    developerName: normalizeText(input.developerName) ?? undefined,
    developerWebsite: normalizeText(input.developerWebsite) ?? undefined,
    status: normalizeStatus(input.status),
    isSeekerCompatible: Boolean(input.isSeekerCompatible),
    isVerified: Boolean(input.isVerified),
    rating: input.rating != null && Number.isFinite(input.rating) ? Number(input.rating) : undefined,
    reviewCount: input.reviewCount != null && Number.isFinite(input.reviewCount) ? Number(input.reviewCount) : undefined,
    categories: Array.from(new Set((input.categories ?? []).map((category) => normalizeText(category) ?? "").filter(Boolean))).slice(0, 20),
    tags: Array.from(new Set((input.tags ?? []).map((tag) => normalizeText(tag) ?? "").filter(Boolean))).slice(0, 20),
    releases: (input.releases ?? []).map(normalizeRelease).filter(Boolean) as DiscoveredRelease[],
  };
}
