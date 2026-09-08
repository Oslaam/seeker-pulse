import type { VercelRequest, VercelResponse } from "@vercel/node";
import { RemoteCatalogProvider } from "../src/lib/dapps/remote-provider.js";
import { syncDapps } from "../src/lib/dapps/sync.js";

function isAuthorized(request: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.authorization;
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!isAuthorized(request)) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const summary = await syncDapps(new RemoteCatalogProvider());
    response.status(200).json({ ok: true, summary });
  } catch (error) {
    response.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : "Catalog refresh failed.",
    });
  }
}
