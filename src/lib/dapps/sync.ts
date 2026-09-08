import { prisma } from "../db.js";
import { normalizeDiscoveredDapp } from "./normalize.js";
import { buildDappStoreDeepLink } from "./deep-link.js";
import { rankDappForPulse } from "./ranking.js";
import { validateDiscoveredDapp } from "./validate.js";
import type { DappCatalogProvider } from "./provider.js";
import type { DiscoveredDapp } from "./types.js";

export interface SyncSummary {
  discovered: number;
  valid: number;
  invalid: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  releases: number;
  errors: number;
}

export async function syncDapps(provider: DappCatalogProvider, options: { dryRun?: boolean } = {}): Promise<SyncSummary> {
  const summary: SyncSummary = { discovered: 0, valid: 0, invalid: 0, created: 0, updated: 0, unchanged: 0, deactivated: 0, releases: 0, errors: 0 };

  const discovered = await provider.discoverDapps();
  summary.discovered = discovered.length;

  const syncLog = options.dryRun ? null : await prisma.dappSyncLog.create({
    data: { provider: getDappSource(provider), status: "running", discovered: discovered.length },
  });

  const seenSourceIds = new Set<string>();
  const existing: any[] = options.dryRun ? [] : await prisma.dapp.findMany({
    include: { releases: true },
  });
  const existingBySourceId = new Map<string, any>(existing.map((entry: any) => [entry.sourceId ?? entry.id, entry]));
  const usedSlugs = new Set<string>(existing.map((entry: any) => entry.slug));
  let connectionLost = false;
  let lastError = "";

  for (const rawDapp of discovered) {
    try {
      const validation = validateDiscoveredDapp(rawDapp);
      if (!validation.valid) {
        summary.invalid += 1;
        console.error("Skipped dApp", { reason: validation.reason });
        continue;
      }
      summary.valid += 1;
      const dapp = normalizeDiscoveredDapp(rawDapp);
      const normalizedSourceId = dapp.sourceId ?? dapp.packageName ?? dapp.name;
      seenSourceIds.add(normalizedSourceId);

      const current: any = existingBySourceId.get(normalizedSourceId) ?? null;
      const slug = current?.slug ?? uniqueSlug(dapp.name, normalizedSourceId, usedSlugs);
      usedSlugs.add(slug);
      const deepLink = buildDappStoreDeepLink(dapp.packageName ?? undefined);
      const pulseScore = rankDappForPulse({
        isActive: dapp.status !== "inactive" && dapp.status !== "archived",
        isVerified: dapp.isVerified,
        isSeekerCompatible: dapp.isSeekerCompatible,
        description: dapp.description,
        shortDescription: dapp.shortDescription,
        website: dapp.website,
        packageName: dapp.packageName,
        releases: dapp.releases,
      });

      if (!options.dryRun) {
        const data = {
          name: dapp.name,
          slug,
          description: dapp.description ?? null,
          shortDescription: dapp.shortDescription ?? null,
          website: dapp.website ?? null,
          iconUrl: dapp.iconUrl ?? null,
          bannerUrl: dapp.bannerUrl ?? null,
          packageName: dapp.packageName ?? null,
          deepLink,
          developerName: dapp.developerName ?? "Unknown",
          developerWebsite: dapp.developerWebsite ?? null,
          status: dapp.status ?? "unknown",
          isActive: dapp.status !== "inactive" && dapp.status !== "archived",
          isVerified: Boolean(dapp.isVerified),
          isSeekerCompatible: Boolean(dapp.isSeekerCompatible),
          rating: dapp.rating ?? null,
          reviewCount: dapp.reviewCount ?? null,
          pulseScore,
            source: dapp.source,
          sourceId: normalizedSourceId,
            sourceUrl: dapp.sourceUrl ?? null,
            metadataUri: dapp.metadataUri ?? null,
            verifiedAt: dapp.verifiedAt ? new Date(dapp.verifiedAt) : null,
          lastSeenAt: new Date(),
        };

        if (!current) {
          await prisma.dapp.create({
            data: {
              ...data,
              firstSeenAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              categories: {
                create: (dapp.categories ?? []).map((category) => ({ category: { connectOrCreate: { where: { name: category }, create: { name: category, slug: slugify(category), description: `Category: ${category}` } } } })),
              },
              tags: {
                create: (dapp.tags ?? []).map((tag) => ({ tag: { connectOrCreate: { where: { name: tag }, create: { name: tag, slug: slugify(tag) } } } })),
              },
              releases: {
                create: (dapp.releases ?? []).map((release) => ({
                  version: release.version ?? "unknown",
                  versionCode: release.versionCode ?? null,
                  packageName: release.packageName ?? dapp.packageName ?? null,
                  releaseDate: release.releaseDate ? new Date(release.releaseDate) : null,
                  metadataUrl: release.metadataUrl ?? null,
                  apkUrl: release.apkUrl ?? null,
                })),
              },
            },
          });
          summary.created += 1;
          summary.releases += (dapp.releases ?? []).length;
        } else {
          const changed = current.name !== dapp.name || current.packageName !== dapp.packageName || current.status !== (dapp.status ?? "unknown") || current.isSeekerCompatible !== Boolean(dapp.isSeekerCompatible) || current.pulseScore !== pulseScore;
          if (changed) {
            await prisma.dapp.update({
              where: { id: current.id },
              data,
            });
            summary.updated += 1;
          } else {
            summary.unchanged += 1;
          }

          for (const release of dapp.releases ?? []) {
            await prisma.dappRelease.upsert({
              where: { dappId_version: { dappId: current.id, version: release.version ?? "unknown" } },
              update: {
                versionCode: release.versionCode ?? null,
                packageName: release.packageName ?? dapp.packageName ?? null,
                releaseDate: release.releaseDate ? new Date(release.releaseDate) : null,
                metadataUrl: release.metadataUrl ?? null,
                apkUrl: release.apkUrl ?? null,
              },
              create: {
                dappId: current.id,
                version: release.version ?? "unknown",
                versionCode: release.versionCode ?? null,
                packageName: release.packageName ?? dapp.packageName ?? null,
                releaseDate: release.releaseDate ? new Date(release.releaseDate) : null,
                metadataUrl: release.metadataUrl ?? null,
                apkUrl: release.apkUrl ?? null,
              },
            });
            summary.releases += 1;
          }
        }
      }
    } catch (error) {
      summary.errors += 1;
      lastError = error instanceof Error ? error.message : String(error);
      console.error("Failed to sync discovered dApp", { error: lastError });
      if (isDatabaseConnectionError(lastError)) {
        connectionLost = true;
        break;
      }
    }
  }

  if (!options.dryRun && !connectionLost) {
    try {
      const orphaned = await prisma.dapp.findMany({
        where: {
          source: getDappSource(provider),
        },
      });

      for (const dapp of orphaned) {
        if (!seenSourceIds.has(dapp.sourceId ?? dapp.packageName ?? dapp.id)) {
          await prisma.dapp.update({
            where: { id: dapp.id },
            data: { isActive: false, status: "inactive", lastSeenAt: new Date() },
          });
          summary.deactivated += 1;
        }
      }
    } catch (error) {
      connectionLost = true;
      summary.errors += 1;
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (syncLog) {
    await prisma.dappSyncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        valid: summary.valid,
        invalid: summary.invalid,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        deactivated: summary.deactivated,
        failed: summary.errors,
        error: lastError || null,
        status: summary.errors > 0 ? (connectionLost ? "failed" : "partial") : "completed",
      },
    });
  }

  return summary;
}

export function getDappSource(provider: DappCatalogProvider): string {
  return provider.constructor.name === "VerifiedSolanaMobileCatalogProvider" ? "solana-mobile" : "verified-import";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dapp";
}

function uniqueSlug(name: string, sourceId: string, usedSlugs: Set<string>): string {
  const base = slugify(name);
  if (!usedSlugs.has(base)) return base;

  const suffix = slugify(sourceId).slice(0, 32) || "source";
  let candidate = `${base}-${suffix}`;
  let counter = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${suffix}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function isDatabaseConnectionError(message: string): boolean {
  return /can't reach database|connection terminated|connection refused|connection reset|timed out|timeout/i.test(message);
}
