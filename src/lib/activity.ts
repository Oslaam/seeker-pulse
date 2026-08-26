const MAX_PAGES = 3;
const PAGE_SIZE = 100;
const WINDOW_DAYS = 30;
const NOISE_SOURCES = new Set(["SYSTEM_PROGRAM", "UNKNOWN", "SOLANA_PROGRAM_LIBRARY", "ASSOCIATED_TOKEN_ACCOUNT_PROGRAM", ""]);

export interface Activity {
  todayCount: number;
  activeDays: number;
  streak: number;
  uniqueDapps: number;
  topSources: Array<{ source: string; count: number }>;
  windowDays: number;
}

class ActivityError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

interface Transaction {
  timestamp?: number;
  signature?: string;
  feePayer?: string;
  source?: string;
}

function utcDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export async function fetchActivity(address: string, apiKey: string): Promise<Activity> {
  const cutoff = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 24 * 60 * 60;
  const transactions: Transaction[] = [];
  let before: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://api.helius.xyz/v0/addresses/${address}/transactions`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (before) url.searchParams.set("before", before);

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) throw new ActivityError("RATE_LIMITED", "Helius rate limit hit — try again in a few seconds.");
      throw new Error(`Helius API error (${response.status}) fetching activity.`);
    }

    const batch = (await response.json()) as Transaction[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    transactions.push(...batch);

    const last = batch[batch.length - 1];
    if (!last?.timestamp || last.timestamp < cutoff) break;
    before = last.signature;
    if (batch.length < PAGE_SIZE) break;
  }

  return summarize(transactions.filter((transaction) => transaction.timestamp && transaction.timestamp >= cutoff), address);
}

function summarize(transactions: Transaction[], address: string): Activity {
  const todayKey = utcDateKey(Math.floor(Date.now() / 1000));
  const dayCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const sourceLastSeen = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.feePayer && transaction.feePayer !== address) continue;
    if (!transaction.timestamp) continue;
    const key = utcDateKey(transaction.timestamp);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    const source = (transaction.source || "UNKNOWN").toUpperCase();
    if (!NOISE_SOURCES.has(source)) {
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      sourceLastSeen.set(source, Math.max(sourceLastSeen.get(source) || 0, transaction.timestamp));
    }
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!dayCounts.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (dayCounts.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source: prettySourceName(source), count }));
  return { todayCount: dayCounts.get(todayKey) || 0, activeDays: dayCounts.size, streak, uniqueDapps: sourceCounts.size, topSources, windowDays: WINDOW_DAYS };
}

function prettySourceName(source: string): string {
  return source.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}