import { searchDapps } from "./repository.js";
import type { DappRecord } from "./types.js";

export interface DetectedDapp {
  dapp: Pick<DappRecord, "id" | "name" | "iconUrl" | "deepLink" | "categories" | "isVerified">;
  interactions: number;
  lastUsedAt: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesSource(dapp: DappRecord, source: string): boolean {
  const target = normalize(source);
  return [dapp.name, dapp.slug, dapp.developerName ?? "", ...dapp.tags.map((tag) => tag.name), ...dapp.categories.map((category) => category.name)]
    .some((value) => normalize(value) === target || normalize(value).includes(target) || target.includes(normalize(value)));
}

export async function detectDappsFromActivity(sources: Array<{ source: string; count: number; lastUsedAt: string }>): Promise<DetectedDapp[]> {
  const detected: DetectedDapp[] = [];
  for (const source of sources.slice(0, 20)) {
    const candidates = await searchDapps({ query: source.source, activeOnly: true, limit: 10, sort: "pulseScore" });
    const dapp = candidates.find((candidate) => matchesSource(candidate, source.source));
    if (!dapp) continue;
    detected.push({
      dapp: { id: dapp.id, name: dapp.name, iconUrl: dapp.iconUrl, deepLink: dapp.deepLink, categories: dapp.categories, isVerified: dapp.isVerified },
      interactions: source.count,
      lastUsedAt: source.lastUsedAt,
    });
  }
  return detected;
}