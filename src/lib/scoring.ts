import type { Activity } from "./activity.js";

const TARGETS = { onchain: 4, dapps: 6, streak: 7 } as const;
const SUGGESTED_DAPPS = [
  { name: "Jupiter", does: "swap tokens" }, { name: "Tensor", does: "browse or trade NFTs" },
  { name: "Kamino", does: "lend or borrow" }, { name: "Drift", does: "try perps or spot trading" },
  { name: "Magic Eden", does: "explore NFT collections" }, { name: "Backpack", does: "manage xNFTs" },
];

export type Verdict = "aligned" | "watch" | "at_risk" | "idle";
export interface ScoreCategory { id: "onchain" | "dapps" | "streak"; label: string; verdict: Verdict; detail: string; value: number; unit: string; }
export interface Suggestion { category: string; text: string; }
export interface Scorecard { overallVerdict: Verdict; pulseScore: number; categories: ScoreCategory[]; suggestions: Suggestion[]; }

function pct(value: number, target: number): number { return Math.max(0, Math.min(100, Math.round((value / target) * 100))); }

export function buildScorecard(activity: Activity, alreadyUsedSources: string[] = []): Scorecard {
  const usedSet = new Set(alreadyUsedSources.map((source) => source.toLowerCase()));
  const recentActive = activity.recentDays.filter((day) => day.count > 0);
  const today = activity.recentDays[0];
  const riskyDays = recentActive.slice(0, 3).filter((day) => day.repetitive && (day.bursty || day.dustHeavy)).length;
  const onchainRisk = Boolean((today?.repetitive && (today.bursty || today.dustHeavy)) || (recentActive.length > 0 && riskyDays > recentActive.slice(0, 3).length / 2));
  const flaggedDays = recentActive.filter((day) => day.repetitive || day.bursty || day.dustHeavy).length;
  const onchainVerdict: Verdict = onchainRisk ? "at_risk" : flaggedDays > 0 ? "watch" : "aligned";
  const lowDiversity = activity.activeDays >= 3 && activity.uniqueDapps <= 2;
  const idle = activity.todayCount === 0 && !onchainRisk && flaggedDays === 0;
  const categories: ScoreCategory[] = [
    { id: "onchain", label: "Onchain Activity", verdict: idle ? "idle" : onchainVerdict, value: activity.todayCount, unit: "transactions today", detail: idle ? "No transactions today, so there is not enough activity to assess natural use yet." : onchainDetail(activity, onchainVerdict) },
    { id: "dapps", label: "dApp Exploration", verdict: activity.uniqueDapps === 0 ? "idle" : lowDiversity ? "watch" : "aligned", value: activity.uniqueDapps, unit: `dApps in ${activity.windowDays} days`, detail: activity.uniqueDapps === 0 ? "No dApps touched in the current activity window." : lowDiversity ? `You've touched the same ${activity.uniqueDapps} program${activity.uniqueDapps === 1 ? "" : "s"} across your active days.` : `${activity.uniqueDapps} program${activity.uniqueDapps === 1 ? "" : "s"} touched in the last ${activity.windowDays} days.` },
    { id: "streak", label: "Daily Use", verdict: onchainRisk && activity.streak > 1 ? "watch" : idle && activity.streak === 0 ? "idle" : "aligned", value: activity.streak, unit: "day streak", detail: onchainRisk && activity.streak > 1 ? "Your streak is intact, but recent activity includes minimal repeated transactions." : activity.streak > 0 ? `Your current streak is ${activity.streak} day${activity.streak === 1 ? "" : "s"}.` : "No active streak today. This is neutral, not a risk signal." },
  ];
  const suggestions: Suggestion[] = [];
  if (idle) suggestions.push({ category: "onchain", text: "You have no recent activity to assess yet — this is idle, not at risk. Use the wallet naturally when you have something you actually want to do." });
  else if (onchainVerdict === "at_risk") suggestions.push({ category: "onchain", text: onchainDetail(activity, "at_risk") });
  else if (onchainVerdict === "aligned") suggestions.push({ category: "onchain", text: "Your activity today looks like natural use — no action needed." });
  if (lowDiversity) {
    const untried = SUGGESTED_DAPPS.filter((dapp) => !usedSet.has(dapp.name.toLowerCase())).slice(0, 3);
    const list = untried.map((dapp) => `${dapp.name} (${dapp.does})`).join(", ");
    suggestions.push({ category: "dapps", text: untried.length > 0 ? `You've touched the same ${activity.uniqueDapps} program${activity.uniqueDapps === 1 ? "" : "s"} all week — try something new: ${list}.` : "Your recent activity stays within a narrow set of programs — try something new that you actually want to use." });
  }
  if (onchainRisk && activity.streak > 1) suggestions.push({ category: "streak", text: "Your streak is intact, but it looks like it's being kept alive with minimal repeated transactions rather than varied use — worth mixing in some real activity." });
  const overallVerdict = idle ? "idle" : categories.some((category) => category.verdict === "at_risk") ? "at_risk" : categories.some((category) => category.verdict === "watch") ? "watch" : "aligned";
  return { overallVerdict, pulseScore: buildPulseScore(activity, onchainRisk, flaggedDays), categories, suggestions };
}

function buildPulseScore(activity: Activity, onchainRisk: boolean, flaggedDays: number): number {
  const activityPoints = Math.min(30, activity.todayCount * 6);
  const explorationPoints = Math.min(30, activity.uniqueDapps * 5);
  const consistencyPoints = Math.min(25, activity.streak * 4) + Math.min(15, activity.activeDays);
  const riskPenalty = (onchainRisk ? 25 : 0) + Math.min(15, flaggedDays * 3);
  return Math.max(0, Math.min(100, activityPoints + explorationPoints + consistencyPoints - riskPenalty));
}

function onchainDetail(activity: Activity, verdict: Verdict): string {
  const day = activity.recentDays.find((candidate) => candidate.repetitive && (candidate.bursty || candidate.dustHeavy));
  if (day && verdict === "at_risk") {
    const signals = [day.bursty ? "in a short burst" : "", day.dustHeavy ? "with negligible amounts" : ""].filter(Boolean).join(" ");
    return `${day.topRepeatedCount || day.count} of ${day.count} transactions on ${day.date} repeated the same pattern${signals ? ` ${signals}` : ""}${day.topRepeatedSource ? ` via ${day.topRepeatedSource}` : ""} — this is the kind of activity Solana Mobile's update is built to discount. Try using a dApp for something you actually want to do instead: a swap, a mint, or an NFT purchase.`;
  }
  return verdict === "watch" ? "Some recent activity has repetition, burst timing, or negligible amounts. It is worth mixing in varied use rather than repeating the same action." : `${activity.todayCount} transactions today; recent activity shows no strong manufactured-use pattern.`;
}