import { prisma } from "../db.js";
import type { DappRecord, DappSearchFilters } from "./types.js";

export async function getDappById(id: string): Promise<DappRecord | null> {
  const record = await prisma.dapp.findUnique({
    where: { id },
    include: { categories: { include: { category: true } }, tags: { include: { tag: true } }, releases: true },
  });
  if (!record) return null;
  return toRecord(record);
}

export async function searchDapps(filters: DappSearchFilters = {}): Promise<DappRecord[]> {
  const query = (filters.query ?? "").trim();
  const category = (filters.category ?? "").trim();
  const tag = (filters.tag ?? "").trim();
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 50));
  const offset = Math.max(0, filters.offset ?? 0);

  const where: Record<string, unknown> = {};
  if (filters.activeOnly !== undefined) where.isActive = filters.activeOnly;
  if (filters.seekerCompatibleOnly) where.isSeekerCompatible = true;
  if (typeof filters.minPulseScore === "number") where.pulseScore = { gte: filters.minPulseScore };
  if (query) {
    const terms = query.split(/\s+/).filter(Boolean);
    where.OR = terms.flatMap((term) => [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
      { developerName: { contains: term, mode: "insensitive" } },
      { packageName: { contains: term, mode: "insensitive" } },
      { categories: { some: { category: { name: { contains: term, mode: "insensitive" } } } } },
      { tags: { some: { tag: { name: { contains: term, mode: "insensitive" } } } } },
    ]);
  }
  if (category) {
    where.categories = { some: { category: { OR: [{ slug: category }, { name: { equals: category, mode: "insensitive" } }] } } };
  }
  if (tag) {
    where.tags = { some: { tag: { OR: [{ slug: tag }, { name: { equals: tag, mode: "insensitive" } }] } } };
  }

  const data: any[] = await prisma.dapp.findMany({
    where,
    include: { categories: { include: { category: true } }, tags: { include: { tag: true } }, releases: true },
    take: limit,
    skip: offset,
    orderBy: filters.sort === "pulseScore" ? { pulseScore: "desc" } : filters.sort === "updatedAt" ? { updatedAt: "desc" } : filters.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
  });

  return data.map((record: any) => toRecord(record));
}

function toRecord(record: any): DappRecord {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    shortDescription: record.shortDescription,
    website: record.website,
    iconUrl: record.iconUrl,
    bannerUrl: record.bannerUrl,
    packageName: record.packageName,
    deepLink: record.deepLink,
    developerName: record.developerName,
    developerWebsite: record.developerWebsite,
    status: record.status,
    isActive: record.isActive,
    isVerified: record.isVerified,
    isSeekerCompatible: record.isSeekerCompatible,
    rating: record.rating,
    reviewCount: record.reviewCount,
    pulseScore: record.pulseScore,
    source: record.source,
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    metadataUri: record.metadataUri,
    verifiedAt: record.verifiedAt,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    categories: record.categories.map((entry: any) => ({ name: entry.category.name, slug: entry.category.slug })),
    tags: record.tags.map((entry: any) => ({ name: entry.tag.name, slug: entry.tag.slug })),
    releases: record.releases.map((entry: any) => ({
      version: entry.version,
      packageName: entry.packageName,
      releaseDate: entry.releaseDate,
    })),
  };
}
