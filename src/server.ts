import "dotenv/config";
import express from "express";
import cors from "cors";
import { resolveIdentity } from "./lib/identity.js";
import { fetchActivity } from "./lib/activity.js";
import { buildScorecard } from "./lib/scoring.js";

const app = express();
const PORT = process.env.PORT || 3000;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = process.env.RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

if (!HELIUS_API_KEY) {
  console.error("Missing HELIUS_API_KEY in .env — see .env.example");
  process.exit(1);
}

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

function nextUtcResetIso(): string {
  const date = new Date();
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}

app.get("/api/domain-suggestions", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim().toLowerCase() : "";
  if (!/^[a-z0-9-]{2,63}$/.test(name)) {
    res.json({ domains: [] });
    return;
  }

  try {
    const identity = await resolveIdentity(`${name}.skr`, RPC_URL);
    res.json({ domains: [{ domain: identity.skrDomain, address: identity.address }] });
  } catch {
    res.json({ domains: [] });
  }
});

app.get("/api/lookup", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  if (!query.trim()) {
    res.status(400).json({ error: "Give me a .skr domain or a wallet address." });
    return;
  }

  try {
    const identity = await resolveIdentity(query, RPC_URL);
    const activity = await fetchActivity(identity.address, HELIUS_API_KEY);
    const scorecard = buildScorecard(activity, activity.topSources.map((source) => source.source));

    res.json({
      input: query,
      address: identity.address,
      skrDomain: identity.skrDomain,
      isSeekerWallet: identity.isSeekerWallet,
      activity,
      scorecard,
      nextResetUtc: nextUtcResetIso(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
    const status = ({ DOMAIN_NOT_FOUND: 404, INVALID_INPUT: 400, RATE_LIMITED: 429 } as Record<string, number>)[code] || 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Something went wrong looking that up." });
  }
});

app.listen(PORT, () => {
  console.log(`Seeker Pulse running at http://localhost:${PORT}`);
});

