import { countAvailableDapps, getDappById, searchDapps } from "../lib/dapps/repository.js";
import { findCandidateDapps, mergeCandidateDappGroups } from "../lib/dapps/search.js";
import { detectDappSearchIntent, recommendDappsForMessage } from "../lib/dapps/ai.js";
import { explainDappRecommendations } from "../lib/dapps/llm.js";
import type { ApiRequest, ApiResponse } from "../api.js";

function queryString(request: ApiRequest, key: string): string | undefined {
  const value = request.query?.[key];
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function queryNumber(request: ApiRequest, key: string): number | undefined {
  const value = queryString(request, key);
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function queryBoolean(request: ApiRequest, key: string): boolean | undefined {
  const value = queryString(request, key)?.toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function listDapps(request: ApiRequest, response: ApiResponse): Promise<void> {
  try {
    const filters = {
      query: queryString(request, "query"),
      category: queryString(request, "category"),
      tag: queryString(request, "tag"),
      activeOnly: queryBoolean(request, "active") ?? true,
      seekerCompatibleOnly: queryBoolean(request, "seekerCompatible"),
      minPulseScore: queryNumber(request, "minPulseScore"),
      limit: queryNumber(request, "limit"),
      offset: queryNumber(request, "offset"),
      sort: queryString(request, "sort") as "relevance" | "pulseScore" | "updatedAt" | "name" | undefined,
    };
    const [dapps, catalogCount] = await Promise.all([
      searchDapps(filters),
      queryBoolean(request, "includeCatalogCount") ? countAvailableDapps() : Promise.resolve(undefined),
    ]);
    response.json({ dapps, count: dapps.length, ...(catalogCount !== undefined ? { catalogCount } : {}) });
  } catch {
    response.status(503).json({ error: "The dApp catalog is currently unavailable." });
  }
}

export async function getDapp(request: ApiRequest, response: ApiResponse): Promise<void> {
  const id = queryString(request, "id");
  if (!id) {
    response.status(400).json({ error: "A dApp id is required." });
    return;
  }
  try {
    const dapp = await getDappById(id);
    if (!dapp) {
      response.status(404).json({ error: "dApp not found." });
      return;
    }
    response.json({ dapp });
  } catch {
    response.status(503).json({ error: "The dApp catalog is currently unavailable." });
  }
}

export async function findDapps(request: { body?: unknown }, response: ApiResponse): Promise<void> {
  const body = request.body && typeof request.body === "object" ? request.body as { message?: unknown } : {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 500) {
    response.status(400).json({ error: "Ask a dApp question in 1 to 500 characters." });
    return;
  }

  try {
    const intent = detectDappSearchIntent(message);
    const candidateGroups = await Promise.all(intent.keywords.slice(0, 5).map((keyword) => searchDapps({
      query: keyword,
      activeOnly: true,
      seekerCompatibleOnly: true,
      limit: 50,
      sort: "pulseScore",
    })));
    const candidatePool = mergeCandidateDappGroups(candidateGroups);
    const candidatesById = new Map(candidatePool.map((dapp) => [dapp.id, dapp]));
    const candidates = findCandidateDapps(candidatePool.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      shortDescription: dapp.shortDescription,
      developerName: dapp.developerName,
      categories: dapp.categories.map((category) => category.slug),
      tags: dapp.tags.map((tag) => tag.slug),
      source: dapp.source,
    })), { query: intent.keywords.join(" "), limit: 50 })
      .flatMap(({ id }) => {
        const dapp = id ? candidatesById.get(id) : undefined;
        return dapp ? [dapp] : [];
      });
    const deterministic = recommendDappsForMessage(message, candidates.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description ?? undefined,
      shortDescription: dapp.shortDescription ?? undefined,
      packageName: dapp.packageName ?? undefined,
      developerName: dapp.developerName ?? undefined,
      categories: dapp.categories.map((category) => category.slug),
      tags: dapp.tags.map((tag) => tag.slug),
    })));
    const llmResponse = await explainDappRecommendations({ message, intent, candidates }).catch(() => null);
    const recommendations = {
      answer: llmResponse?.answer ?? deterministic.answer,
      recommendations: deterministic.recommendations,
    };
    const resolved = (await Promise.all(recommendations.recommendations.map(async (recommendation) => ({
      ...recommendation,
      dapp: await getDappById(recommendation.dappId),
    })))).filter((recommendation): recommendation is typeof recommendation & { dapp: NonNullable<typeof recommendation.dapp> } => Boolean(recommendation.dapp));

    response.json({
      answer: resolved.length > 0 ? recommendations.answer : "I could not find a verified dApp in the current catalog for that request.",
      intent,
      recommendations: resolved,
    });
  } catch {
    response.status(503).json({ error: "The dApp recommendation service is currently unavailable." });
  }
}