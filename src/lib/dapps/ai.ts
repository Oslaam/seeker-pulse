import { z } from "zod";
import type { DappRecommendationResponse, DappSearchIntent, DiscoveredDapp } from "./types.js";

const DappRecommendationSchema = z.object({
  answer: z.string().min(1),
  recommendations: z.array(z.object({
    dappId: z.string().min(1),
    reason: z.string().min(1),
    relevance: z.number().min(0).max(1),
  })).max(10),
});

export function detectDappSearchIntent(message: string): DappSearchIntent {
  const text = message.toLowerCase();
  const stopWords = new Set(["need", "want", "would", "like", "find", "show", "give", "get", "app", "apps", "where", "can", "my", "me", "the", "for", "with", "from", "some", "an", "something", "looking", "please", "help", "use", "using"]);
  const assets = Array.from(new Set((text.match(/\b(?:skr|solana|usdc|usdt|bonk|sol|eth|btc|nft|meme)\b/g) ?? []).map((value) => value.toUpperCase())));

  const intentByPattern = [
    { pattern: /stake|staking|yield/, intent: "staking", categories: ["defi"] },
    { pattern: /swap|trade|trading|exchange/, intent: "trading", categories: ["defi"] },
    { pattern: /nft|collectible|mint/, intent: "nfts", categories: ["nft"] },
    { pattern: /game|gaming|play/, intent: "gaming", categories: ["gaming"] },
    { pattern: /wallet|send|receive|manage/, intent: "wallet", categories: ["wallet"] },
    { pattern: /social|chat|community/, intent: "social", categories: ["social"] },
    { pattern: /ai|agent/, intent: "ai", categories: ["ai"] },
    { pattern: /earn|yield|farm/, intent: "earning", categories: ["defi"] },
    { pattern: /security|safe|guard/, intent: "security", categories: ["security"] },
    { pattern: /productivity|utility|tools/, intent: "productivity", categories: ["productivity"] },
  ];

  const matched = intentByPattern.find((entry) => entry.pattern.test(text)) ?? (assets.includes("SKR")
    ? { intent: "skr_discovery", categories: ["defi", "wallet"], pattern: /skr/ }
    : { intent: "discovery", categories: ["utility"], pattern: /./ });
  const keywords = Array.from(new Set([
    ...text.split(/[^a-z0-9]+/).filter((part) => part.length > 2 && !stopWords.has(part)),
    ...(matched.categories ?? []),
    ...assets.map((asset) => asset.toLowerCase()),
  ]));

  return {
    intent: matched.intent,
    assets,
    categories: matched.categories,
    keywords: keywords.slice(0, 12),
    limit: 5,
  };
}

export function recommendDappsForMessage(message: string, dapps: Array<Partial<DiscoveredDapp> & { id?: string }>): DappRecommendationResponse {
  const intent = detectDappSearchIntent(message);
  const ranked = dapps
    .map((dapp) => {
      const name = normalizeSearchText(dapp.name);
      const description = normalizeSearchText([dapp.shortDescription, dapp.description].filter(Boolean).join(" "));
      const metadata = normalizeSearchText([dapp.developerName, ...(dapp.categories ?? []), ...(dapp.tags ?? [])].join(" "));
      const haystack = `${name} ${description} ${metadata}`;
      let relevance = 0;
      const matchedKeywords: string[] = [];
      for (const keyword of intent.keywords) {
        if (!keyword) continue;
        const normalizedKeyword = normalizeSearchText(keyword);
        if (name.includes(normalizedKeyword)) {
          relevance += 0.32;
          matchedKeywords.push(keyword);
        } else if (description.includes(normalizedKeyword) || relatedWordMatch(description, normalizedKeyword)) {
          relevance += 0.24;
          matchedKeywords.push(keyword);
        } else if (metadata.includes(normalizedKeyword)) {
          relevance += 0.16;
          matchedKeywords.push(keyword);
        } else if (haystack.includes(normalizedKeyword)) {
          relevance += 0.08;
        }
      }
      const categoryMatch = intent.categories.length > 0 && dapp.categories?.some((category) => intent.categories.includes(normalizeSearchText(category)));
      if (categoryMatch) relevance += 0.2;
      const assetMatch = intent.assets.some((asset) => haystack.includes(normalizeSearchText(asset)));
      if (assetMatch) relevance += 0.28;
      if (dapp.packageName) relevance += 0.03;
      const reason = matchedKeywords.length > 0
        ? `Matches ${matchedKeywords.slice(0, 3).join(", ")} in verified app metadata${assetMatch ? ` and references ${intent.assets.join(", ")}` : ""}.`
        : `Matches the ${intent.intent} category.`;
      return { dappId: dapp.id ?? dapp.packageName ?? "unknown", reason, relevance: Math.min(0.99, relevance) };
    })
    .filter((item) => item.dappId !== "unknown")
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, intent.limit);

  const answer = ranked.length > 0
    ? intent.assets.includes("SKR")
      ? `I found ${ranked.length} verified Seeker dApps with SKR-related metadata in the current catalog.`
      : `I found ${ranked.length} candidate dApps that best match your ${intent.intent} request.`
    : `I could not find a strong match from the current catalog for that request.`;

  const result = { answer, recommendations: ranked.map((item) => ({ dappId: item.dappId, reason: item.reason, relevance: Number(item.relevance.toFixed(2)) })) };
  return DappRecommendationSchema.parse(result) as DappRecommendationResponse;
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function relatedWordMatch(text: string, keyword: string): boolean {
  if (keyword.length < 4) return false;
  const stem = keyword.endsWith("ing") ? keyword.slice(0, -3) : keyword.endsWith("ed") ? keyword.slice(0, -2) : keyword.endsWith("s") ? keyword.slice(0, -1) : keyword;
  return stem.length >= 4 && text.split(/\s+/).some((word) => word.startsWith(stem));
}
