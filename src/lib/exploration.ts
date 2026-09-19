export interface DappOpenRecord {
  dappId: string;
  dappName: string;
  category: string;
  firstOpenedAt: string;
  lastOpenedAt: string;
  openCount: number;
}

export interface JourneySummary {
  weeklyExplorationCount: number;
  mostExplored: Array<{ dappId: string; name: string; count: number; category: string; lastOpenedAt: string }>;
  recentlyExplored: Array<{ dappId: string; name: string; label: string; category: string; lastOpenedAt: string }>;
  categories: Array<{ name: string; count: number; totalOpens: number }>;
  newDiscoveries: number;
  nextMove: string;
}

function toTimestamp(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getTime();
}

export function buildJourneySummary(records: DappOpenRecord[], nowIso: string): JourneySummary {
  const now = new Date(nowIso).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const inWeek = records.filter((record) => now - toTimestamp(record.lastOpenedAt) <= oneWeekMs);

  const weeklyExplorationCount = inWeek.reduce((total, record) => total + record.openCount, 0);
  const mostExplored = [...records]
    .sort((left, right) => right.openCount - left.openCount || toTimestamp(right.lastOpenedAt) - toTimestamp(left.lastOpenedAt))
    .slice(0, 3)
    .map((record) => ({ dappId: record.dappId, name: record.dappName, count: record.openCount, category: record.category || "exploration", lastOpenedAt: record.lastOpenedAt }));

  const recentlyExplored = [...records]
    .sort((left, right) => toTimestamp(right.lastOpenedAt) - toTimestamp(left.lastOpenedAt))
    .slice(0, 3)
    .map((record) => ({ dappId: record.dappId, name: record.dappName, label: record.openCount > 1 ? "Explored" : "Opened", category: record.category || "exploration", lastOpenedAt: record.lastOpenedAt }));

  const categoryMap = new Map<string, { name: string; count: number; totalOpens: number }>();
  for (const record of records) {
    const key = record.category || "exploration";
    const current = categoryMap.get(key) ?? { name: key, count: 0, totalOpens: 0 };
    current.count += 1;
    current.totalOpens += record.openCount;
    categoryMap.set(key, current);
  }

  const categories = [...categoryMap.values()]
    .sort((left, right) => right.totalOpens - left.totalOpens || right.count - left.count)
    .slice(0, 4)
    .map((entry) => ({ ...entry, name: entry.name.toLowerCase() }));

  const newDiscoveries = records.filter((record) => now - toTimestamp(record.lastOpenedAt) <= oneWeekMs).length;
  const preferredCategory = categories[0]?.name?.toLowerCase() ?? "exploration";
  const nextMove = preferredCategory === "defi"
    ? "You’ve explored mostly DeFi. Try a game or social app to keep your Seeker rhythm varied."
    : preferredCategory === "gaming"
      ? "You’re leaning into games. Try a DeFi or wallet app next to broaden your daily flow."
      : preferredCategory === "social"
        ? "Social is your current lane. Try a wallet or trading app for a balanced Seeker loop."
        : "Your journey is still fresh. Open one verified dApp from the catalog to start a daily habit.";

  return { weeklyExplorationCount, mostExplored, recentlyExplored, categories, newDiscoveries, nextMove };
}