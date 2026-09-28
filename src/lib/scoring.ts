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
    { id: "dapps", label: "Recognized protocols", verdict: activity.uniqueDapps === 0 ? "idle" : lowDiversity ? "watch" : "aligned", value: activity.uniqueDapps, unit: `protocol labels in ${activity.windowDays} days`, detail: activity.uniqueDapps === 0 ? "No recognized protocol labels appeared in the available public transactions." : lowDiversity ? `Only ${activity.uniqueDapps} recognized protocol label${activity.uniqueDapps === 1 ? "" : "s"} appeared in the ${activity.windowDays}-day window.` : `${activity.uniqueDapps} recognized protocol labels appeared in the last ${activity.windowDays} days.` },
    { id: "streak", label: "Daily Use", verdict: onchainRisk && activity.streak > 1 ? "watch" : idle && activity.streak === 0 ? "idle" : "aligned", value: activity.streak, unit: "day streak", detail: onchainRisk && activity.streak > 1 ? "Your streak is intact, but recent activity includes minimal repeated transactions." : activity.streak > 0 ? `Your current streak is ${activity.streak} day${activity.streak === 1 ? "" : "s"}.` : "No active streak today. This is neutral, not a risk signal." },
  ];
  const suggestions: Suggestion[] = [];
  if (idle) suggestions.push({ category: "onchain", text: "You have no recent activity to assess yet — this is idle, not at risk. Use the wallet naturally when you have something you actually want to do." });
  else if (onchainVerdict === "at_risk") suggestions.push({ category: "onchain", text: onchainDetail(activity, "at_risk") });
  else if (onchainVerdict === "aligned") suggestions.push({ category: "onchain", text: "Pulse detected no strong repetition or burst pattern in today's public transactions. This is not an official assessment." });
  if (lowDiversity) {
    const untried = SUGGESTED_DAPPS.filter((dapp) => !usedSet.has(dapp.name.toLowerCase())).slice(0, 3);
    const list = untried.map((dapp) => `${dapp.name} (${dapp.does})`).join(", ");
    suggestions.push({ category: "dapps", text: untried.length > 0 ? `Only ${activity.uniqueDapps} recognized protocol label${activity.uniqueDapps === 1 ? "" : "s"} appeared in recent transactions. If useful, explore another app: ${list}.` : "Only a few recognized protocol labels appeared in recent transactions; Pulse may not identify every app or activity." });
  }
  if (onchainRisk && activity.streak > 1) suggestions.push({ category: "streak", text: "Pulse detected repeated or low-variation transactions during this streak. It cannot determine why they occurred or predict official scoring." });
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
    return `${day.topRepeatedCount || day.count} of ${day.count} transactions on ${day.date} repeated the same pattern${signals ? ` ${signals}` : ""}${day.topRepeatedSource ? ` via ${day.topRepeatedSource}` : ""}. This Pulse heuristic cannot determine intent or predict Solana Mobile's scoring.`;
  }
  return verdict === "watch" ? "Pulse detected repetition, burst timing, or low-value transfers in the available public transactions. This is a heuristic, not a judgment or official score." : `${activity.todayCount} transactions today; Pulse detected no strong repetition pattern in the available public data.`;
}