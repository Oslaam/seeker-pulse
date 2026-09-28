import type { DappRecord, DappSearchFilters } from "./types.js";

export function findCandidateDapps<T extends { id?: string; name?: string; shortDescription?: string | null; description?: string | null; categories?: string[]; tags?: string[]; developerName?: string | null; source?: string }>(
  dapps: T[],
  filters: DappSearchFilters = {},
): T[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const category = (filters.category ?? "").trim().toLowerCase();
  const tag = (filters.tag ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(filters.limit ?? 10, 50));

  const scored = dapps
    .map((dapp) => {
      const haystack = [
        dapp.name ?? "",
        dapp.shortDescription ?? "",
        dapp.description ?? "",
        dapp.developerName ?? "",
        ...(dapp.categories ?? []),
        ...(dapp.tags ?? []),
        dapp.source ?? "",
      ].join(" ").toLowerCase();

      let score = 0;
      if (query) {
        const qParts = query.split(/\s+/).filter(Boolean);
        for (const part of qParts) {
          if (haystack.includes(part)) score += 2;
          if ((dapp.name ?? "").toLowerCase().includes(part)) score += 2;
          if ((dapp.description ?? "").toLowerCase().includes(part)) score += 1;
          if ((dapp.categories ?? []).some((entry) => entry.toLowerCase().includes(part))) score += 2;
          if ((dapp.tags ?? []).some((entry) => entry.toLowerCase().includes(part))) score += 2;
        }
      }

      if (category && (dapp.categories ?? []).some((entry) => entry.toLowerCase() === category)) score += 5;
      if (tag && (dapp.tags ?? []).some((entry) => entry.toLowerCase() === tag)) score += 5;

      return { dapp, score };
    })
    .filter(({ dapp, score }) => {
      const matchesText = !query || score > 0;
      const matchesCategory = !category || (dapp.categories ?? []).some((entry) => entry.toLowerCase() === category);
      const matchesTag = !tag || (dapp.tags ?? []).some((entry) => entry.toLowerCase() === tag);
      return matchesText && matchesCategory && matchesTag;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ dapp }) => dapp);

  return scored;
}

export function mergeCandidateDappGroups<T extends { id?: string }>(groups: T[][]): T[] {
  const unique = new Map<string, T>();
  for (const group of groups) {
    for (const dapp of group) {
      if (dapp.id && !unique.has(dapp.id)) unique.set(dapp.id, dapp);
    }
  }
  return [...unique.values()];
}

export function buildDappSearchQuery(filter: DappSearchFilters): string {
  return [
    filter.query,
    filter.category,
    filter.tag,
    filter.activeOnly ? "active" : "",
    filter.seekerCompatibleOnly ? "seeker" : "",
  ].filter(Boolean).join(" ");
}

export function dappMatchesQuery(candidate: Partial<DappRecord>, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [
    candidate.name ?? "",
    candidate.description ?? "",
    candidate.shortDescription ?? "",
    candidate.developerName ?? "",
    ...(candidate.categories ?? []).map((entry) => entry.name),
    ...(candidate.tags ?? []).map((entry) => entry.name),
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}
