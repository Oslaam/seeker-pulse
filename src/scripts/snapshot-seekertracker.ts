import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = "https://seekertracker.com/api/dappstore?status=active";
const outputPath = path.resolve("data/dapps.seekertracker.snapshot.json");

type CatalogRecord = {
  androidPackage?: string;
  status?: string;
  removedAt?: string | null;
  rating?: { rating?: number; reviewsByRating?: number[] } | null;
  lastRelease?: {
    displayName?: string;
    subtitle?: string;
    description?: string;
    updatedOn?: string;
    newInVersion?: string;
    icon?: { uri?: string };
    publisherDetails?: {
      name?: string;
      website?: string;
      websiteOverride?: string;
    };
    androidDetails?: { version?: string; versionCode?: number };
  };
};

type SnapshotInput = { data?: unknown; activeCount?: number; lastSyncAt?: string };

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

function normalizeRecord(record: CatalogRecord, verifiedAt: string) {
  const release = record.lastRelease ?? {};
  const publisher = release.publisherDetails ?? {};
  const website = publisher.websiteOverride ?? publisher.website;
  const sourceId = record.androidPackage?.trim();
  if (!sourceId || !release.displayName?.trim()) return null;

  return {
    source: "seekertracker-snapshot",
    sourceId,
    sourceUrl: endpoint,
    verifiedAt,
    name: release.displayName.trim(),
    description: release.description?.trim() || undefined,
    shortDescription: release.subtitle?.trim() || undefined,
    website: website?.trim() || undefined,
    iconUrl: release.icon?.uri?.trim() || undefined,
    packageName: sourceId,
    developerName: publisher.name?.trim() || undefined,
    developerWebsite: website?.trim() || undefined,
    status: record.status === "active" ? "active" : "inactive",
    isSeekerCompatible: true,
    isVerified: false,
    rating: typeof record.rating?.rating === "number" ? record.rating.rating : undefined,
    reviewCount: Array.isArray(record.rating?.reviewsByRating)
      ? record.rating.reviewsByRating.reduce((total, count) => total + (Number.isFinite(count) ? count : 0), 0)
      : undefined,
    releases: release.androidDetails?.version
      ? [{
          version: release.androidDetails.version,
          versionCode: release.androidDetails.versionCode?.toString(),
          packageName: sourceId,
          releaseDate: release.updatedOn,
        }]
      : [],
  };
}

let response: Response | undefined;
let lastError: unknown;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(120_000) });
    if (response.ok) break;
    throw new Error(`SeekerTracker snapshot failed with HTTP ${response.status}.`);
  } catch (error) {
    lastError = error;
    if (attempt < 3) console.warn(`Snapshot request failed on attempt ${attempt}; retrying.`);
  }
}
if (!response?.ok) throw lastError instanceof Error ? lastError : new Error("SeekerTracker snapshot request failed.");
const payload = await response.json() as SnapshotInput;
const verifiedAt = new Date().toISOString();
const records = collectRecords(payload.data)
  .map((record) => normalizeRecord(record, verifiedAt))
  .filter((record): record is NonNullable<typeof record> => Boolean(record));
const unique = Array.from(new Map(records.map((record) => [record.sourceId, record])).values());

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(unique, null, 2)}\n`, "utf8");
console.log(`Downloaded ${unique.length} unique records from ${endpoint}`);
console.log(`Snapshot written to ${outputPath}`);
console.log(`Catalog response activeCount: ${payload.activeCount ?? "unknown"}`);
console.log(`Snapshot timestamp: ${verifiedAt}`);
