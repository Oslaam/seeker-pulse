import { resolveIdentity } from "./lib/identity.js";
import { fetchActivity } from "./lib/activity.js";
import { buildScorecard } from "./lib/scoring.js";

export interface ApiRequest {
  query?: Record<string, unknown>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = process.env.RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY || ""}`;

function nextUtcResetIso(): string {
  const date = new Date();
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}

export async function domainSuggestions(request: ApiRequest, response: ApiResponse): Promise<void> {
  const name = typeof request.query?.name === "string" ? request.query.name.trim().toLowerCase() : "";
  if (!/^[a-z0-9-]{2,63}$/.test(name)) {
    response.json({ domains: [] });
    return;
  }

  try {
    const identity = await resolveIdentity(`${name}.skr`, RPC_URL);
    response.json({ domains: [{ domain: identity.skrDomain, address: identity.address }] });
  } catch {
    response.json({ domains: [] });
  }
}

export async function lookup(request: ApiRequest, response: ApiResponse): Promise<void> {
  const query = typeof request.query?.q === "string" ? request.query.q : "";
  if (!query.trim()) {
    response.status(400).json({ error: "Give me a .skr domain or a wallet address." });
    return;
  }
  if (!HELIUS_API_KEY) {
    response.status(500).json({ error: "Server is missing HELIUS_API_KEY." });
    return;
  }

  try {
    const identity = await resolveIdentity(query, RPC_URL);
    const activity = await fetchActivity(identity.address, HELIUS_API_KEY);
    const scorecard = buildScorecard(activity, activity.topSources.map((source) => source.source));
    response.json({ input: query, address: identity.address, skrDomain: identity.skrDomain, isSeekerWallet: identity.isSeekerWallet, activity, scorecard, nextResetUtc: nextUtcResetIso(), generatedAt: new Date().toISOString() });
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
    const status = ({ DOMAIN_NOT_FOUND: 404, INVALID_INPUT: 400, RATE_LIMITED: 429 } as Record<string, number>)[code] || 500;
    response.status(status).json({ error: error instanceof Error ? error.message : "Something went wrong looking that up." });
  }
}