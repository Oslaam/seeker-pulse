import type { Activity } from "./activity.js";

const TARGETS = { onchain: 4, dapps: 6, streak: 7 } as const;
const SUGGESTED_DAPPS = [
  { name: "Jupiter", does: "swap tokens" }, { name: "Tensor", does: "browse or trade NFTs" },
  { name: "Kamino", does: "lend or borrow" }, { name: "Drift", does: "try perps or spot trading" },
  { name: "Magic Eden", does: "explore NFT collections" }, { name: "Backpack", does: "manage xNFTs" },
];

export interface ScoreRing { id: string; label: string; value: number; target: number; unit: string; percent: number; }
export interface Suggestion { ring: string; text: string; }
export interface Scorecard { rings: ScoreRing[]; suggestions: Suggestion[]; targets: typeof TARGETS; }

function pct(value: number, target: number): number { return Math.max(0, Math.min(100, Math.round((value / target) * 100))); }

export function buildScorecard(activity: Activity, alreadyUsedSources: string[] = []): Scorecard {
  const usedSet = new Set(alreadyUsedSources.map((source) => source.toLowerCase()));
  const rings: ScoreRing[] = [
    { id: "onchain", label: "Onchain Activity", value: activity.todayCount, target: TARGETS.onchain, unit: "txns today", percent: pct(activity.todayCount, TARGETS.onchain) },
    { id: "dapps", label: "dApp Exploration", value: activity.uniqueDapps, target: TARGETS.dapps, unit: `dApps in ${activity.windowDays}d`, percent: pct(activity.uniqueDapps, TARGETS.dapps) },
    { id: "streak", label: "Daily Use", value: activity.streak, target: TARGETS.streak, unit: "day streak", percent: pct(activity.streak, TARGETS.streak) },
  ];
  const suggestions: Suggestion[] = [];
  if (rings[0].percent < 100) {
    const remaining = TARGETS.onchain - activity.todayCount;
    suggestions.push({ ring: "onchain", text: remaining > 0 ? `Log ${remaining} more transaction${remaining === 1 ? "" : "s"} today — a swap, a transfer, or claiming something all count.` : "You're on track for today — keep it up." });
  }
  if (rings[1].percent < 100) {
    const untried = SUGGESTED_DAPPS.filter((dapp) => !usedSet.has(dapp.name.toLowerCase())).slice(0, 3);
    const list = untried.map((dapp) => `${dapp.name} (${dapp.does})`).join(", ");
    suggestions.push({ ring: "dapps", text: untried.length > 0 ? `You've touched ${activity.uniqueDapps} dApp${activity.uniqueDapps === 1 ? "" : "s"} in the last ${activity.windowDays} days. Try something new: ${list}.` : `You've touched ${activity.uniqueDapps} dApps — solid range, keep mixing it up.` });
  }
  if (rings[2].percent < 100) suggestions.push({ ring: "streak", text: activity.streak === 0 ? "No active streak right now — one transaction today starts a new one." : `You're on a ${activity.streak}-day streak. One transaction today keeps it alive.` });
  if (suggestions.length === 0) suggestions.push({ ring: "all", text: "All three rings are full for today — that's natural, well-rounded use. Nice." });
  return { rings, suggestions, targets: TARGETS };
}