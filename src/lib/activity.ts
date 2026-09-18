const MAX_PAGES = 3;
const PAGE_SIZE = 100;
const WINDOW_DAYS = 30;
const NOISE_SOURCES = new Set(["SYSTEM_PROGRAM", "UNKNOWN", "SOLANA_PROGRAM_LIBRARY", "ASSOCIATED_TOKEN_ACCOUNT_PROGRAM", ""]);
const configuredDustThreshold = Number(process.env.DUST_THRESHOLD);
export const DUST_THRESHOLD = Number.isFinite(configuredDustThreshold) && configuredDustThreshold >= 0 ? configuredDustThreshold : 0.001;

export interface DayAssessment {
  date: string;
  count: number;
  repetitive: boolean;
  bursty: boolean;
  dustHeavy: boolean;
  topRepeatedSource?: string;
  topRepeatedCount?: number;
  burstWindowStart?: string;
  burstWindowCount?: number;
}

export interface Activity {
  todayCount: number;
  activeDays: number;
  streak: number;
  uniqueDapps: number;
  topSources: Array<{ source: string; count: number; lastUsedAt: string }>;
  windowDays: number;
  recentDays: DayAssessment[];
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
  type?: string;
  nativeTransfers?: Array<{ amount?: number }>;
  tokenTransfers?: Array<{ tokenAmount?: number }>;
  instructions?: Array<{ program?: string; programId?: string; type?: string }>;
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

export function summarize(transactions: Transaction[], address: string): Activity {
  const todayKey = utcDateKey(Math.floor(Date.now() / 1000));
  const dayCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const sourceLastSeen = new Map<string, number>();
  const transactionsByDay = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.feePayer && transaction.feePayer !== address) continue;
    if (!transaction.timestamp) continue;
    const key = utcDateKey(transaction.timestamp);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    const dayTransactions = transactionsByDay.get(key) || [];
    dayTransactions.push(transaction);
    transactionsByDay.set(key, dayTransactions);
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

  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source: prettySourceName(source), count, lastUsedAt: new Date((sourceLastSeen.get(source) || 0) * 1000).toISOString() }));
  const recentDays: DayAssessment[] = [];
  const recentCursor = new Date();
  recentCursor.setUTCHours(0, 0, 0, 0);
  for (let day = 0; day < 7; day++) {
    const date = recentCursor.toISOString().slice(0, 10);
    recentDays.push(assessDay(date, transactionsByDay.get(date) || []));
    recentCursor.setUTCDate(recentCursor.getUTCDate() - 1);
  }
  return { todayCount: dayCounts.get(todayKey) || 0, activeDays: dayCounts.size, streak, uniqueDapps: sourceCounts.size, topSources, windowDays: WINDOW_DAYS, recentDays };
}

function assessDay(date: string, transactions: Transaction[]): DayAssessment {
  const groups = new Map<string, { source: string; count: number }>();
  const timestamps = transactions.map((transaction) => transaction.timestamp).filter((timestamp): timestamp is number => typeof timestamp === "number").sort((a, b) => a - b);
  let burstCount = 0;
  let burstStart: number | undefined;
  for (let start = 0; start < timestamps.length; start++) {
    let end = start;
    while (end < timestamps.length && timestamps[end] - timestamps[start] <= 5 * 60) end++;
    if (end - start > burstCount) {
      burstCount = end - start;
      burstStart = timestamps[start];
    }
  }

  let dustCount = 0;
  for (const transaction of transactions) {
    const source = programSource(transaction);
    const amount = transferAmount(transaction);
    if (amount !== undefined && amount < DUST_THRESHOLD) dustCount++;
    const groupKey = `${source}|${instructionType(transaction)}|${amount === undefined ? "none" : roughAmount(amount)}`;
    const group = groups.get(groupKey) || { source, count: 0 };
    group.count++;
    groups.set(groupKey, group);
  }
  const repeated = [...groups.values()].sort((a, b) => b.count - a.count)[0];
  const repetitive = Boolean(repeated && repeated.count >= 3 && repeated.count / transactions.length > 0.6);
  return { date, count: transactions.length, repetitive, bursty: burstCount >= 4, dustHeavy: transactions.length > 0 && dustCount / transactions.length >= 0.5, ...(repetitive && repeated ? { topRepeatedSource: repeated.source, topRepeatedCount: repeated.count } : {}), ...(burstCount >= 4 && burstStart !== undefined ? { burstWindowStart: new Date(burstStart * 1000).toISOString(), burstWindowCount: burstCount } : {}) };
}

function programSource(transaction: Transaction): string {
  const instruction = transaction.instructions?.[0];
  return (instruction?.program || instruction?.programId || transaction.source || "UNKNOWN").toUpperCase();
}

function instructionType(transaction: Transaction): string {
  return (transaction.instructions?.[0]?.type || transaction.type || "UNKNOWN").toUpperCase();
}

function transferAmount(transaction: Transaction): number | undefined {
  const amounts = [
    ...(transaction.nativeTransfers || []).map((transfer) => typeof transfer.amount === "number" ? transfer.amount / 1_000_000_000 : undefined),
    ...(transaction.tokenTransfers || []).map((transfer) => typeof transfer.tokenAmount === "number" ? transfer.tokenAmount : undefined),
  ].filter((amount): amount is number => amount !== undefined);
  return amounts.length > 0 ? Math.max(...amounts) : undefined;
}

function roughAmount(amount: number): string {
  if (amount === 0 || Math.abs(amount) < DUST_THRESHOLD) return "dust";
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(amount)) - 1);
  return String(Math.round(amount / magnitude) * magnitude);
}

function prettySourceName(source: string): string {
  return source.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}