import type { DappCatalogProvider } from "./provider.js";
import type { DiscoveredDapp } from "./types.js";

const endpoint = "https://seekertracker.com/api/dappstore?status=active";

type CatalogRecord = {
  androidPackage?: string;
  status?: string;
  rating?: { rating?: number; reviewsByRating?: number[] } | null;
  lastRelease?: {
    displayName?: string;
    subtitle?: string;
    description?: string;
    updatedOn?: string;
    icon?: { uri?: string };
    publisherDetails?: { name?: string; website?: string; websiteOverride?: string };
    androidDetails?: { version?: string; versionCode?: number };
  };
};

function collectRecords(value: unknown, output: CatalogRecord[] = []): CatalogRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const record = value as CatalogRecord;
  if (typeof record.androidPackage === "string" && record.lastRelease) output.push(record);
  for (const item of Object.values(value)) collectRecords(item, output);
  return output;
}

function normalizeRecord(record: CatalogRecord, verifiedAt: string): DiscoveredDapp | null {
  const release = record.lastRelease;
  const publisher = release?.publisherDetails;
  const packageName = record.androidPackage?.trim();
  const name = release?.displayName?.trim();
  if (!packageName || !name) return null;
  const website = (publisher?.websiteOverride ?? publisher?.website)?.trim();
  const reviews = record.rating?.reviewsByRating;

  return {
    source: "seekertracker-snapshot",
    sourceId: packageName,
    sourceUrl: endpoint,
    verifiedAt,
    name,
    description: release?.description?.trim() || undefined,
    shortDescription: release?.subtitle?.trim() || undefined,
    website: website || undefined,
    iconUrl: release?.icon?.uri?.trim() || undefined,
    packageName,
    developerName: publisher?.name?.trim() || undefined,
    developerWebsite: website || undefined,
    status: record.status === "active" ? "active" : "inactive",
    isSeekerCompatible: true,
    isVerified: false,
    rating: typeof record.rating?.rating === "number" ? record.rating.rating : undefined,
    reviewCount: reviews?.reduce((total, count) => total + (Number.isFinite(count) ? count : 0), 0),
    releases: release?.androidDetails?.version ? [{
      version: release.androidDetails.version,
      versionCode: release.androidDetails.versionCode?.toString(),
      packageName,
      releaseDate: release.updatedOn,
    }] : [],
  };
}

export class RemoteCatalogProvider implements DappCatalogProvider {
  async discoverDapps(): Promise<DiscoveredDapp[]> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Catalog source returned HTTP ${response.status}.`);
        const payload = await response.json() as { data?: unknown };
        const verifiedAt = new Date().toISOString();
        const records = collectRecords(payload.data)
          .map((record) => normalizeRecord(record, verifiedAt))
          .filter((record): record is DiscoveredDapp => Boolean(record));
        return Array.from(new Map(records.map((record) => [record.sourceId ?? record.packageName, record])).values());
      } catch (error) {
        lastError = error;
        if (attempt < 3) continue;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Catalog source request failed.");
  }
}
