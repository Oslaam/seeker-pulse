import { z } from "zod";
import type { DappRecord, DappRecommendationResponse, DappSearchIntent } from "./types.js";

const LlmRecommendationSchema = z.object({
  answer: z.string().min(1).max(1000),
  recommendations: z.array(z.object({
    dappId: z.string().min(1),
    reason: z.string().min(1).max(500),
    relevance: z.number().min(0).max(1),
  })).max(5),
});

const apiResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

export async function explainDappRecommendations(input: {
  message: string;
  intent: DappSearchIntent;
  candidates: DappRecord[];
}): Promise<DappRecommendationResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || input.candidates.length === 0) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const candidateData = input.candidates.map((dapp) => ({
    id: dapp.id,
    name: dapp.name,
    shortDescription: dapp.shortDescription,
    description: dapp.description,
    developer: dapp.developerName,
    categories: dapp.categories.map((category) => category.slug),
    tags: dapp.tags.map((tag) => tag.slug),
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Seeker Pulse's dApp recommendation explainer. Use each candidate's name, shortDescription, description, categories, and tags as the primary evidence. Prefer candidates whose name or description directly matches the user's request. Recommend only dApp IDs present in the supplied candidate list. Never invent dApps, metadata, URLs, package names, ratings, scores, capabilities, or transaction actions. Return JSON only with answer and recommendations. If the candidates do not support the request, return an empty recommendations array and say that clearly.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: input.message,
            intent: input.intent,
            candidates: candidateData,
            output: {
              answer: "string",
              recommendations: [{ dappId: "candidate id", reason: "grounded in supplied metadata", relevance: 0.0 }],
            },
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`LLM provider returned HTTP ${response.status}.`);
  const payload = apiResponseSchema.parse(await response.json());
  const content = payload.choices[0].message.content;
  if (!content) throw new Error("LLM provider returned an empty response.");
  return LlmRecommendationSchema.parse(JSON.parse(content));
}
