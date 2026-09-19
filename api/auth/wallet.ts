import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createWalletChallenge, verifyWalletChallenge } from "../../src/api/auth.js";
import { applyCors } from "../_cors.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!applyCors(request, response)) return;
  try {
    if (request.method === "GET") {
      await createWalletChallenge(request, response);
      return;
    }
    if (request.method === "POST") {
      await verifyWalletChallenge(request, response);
      return;
    }
    response.status(405).json({ error: "Method not allowed." });
  } catch {
    response.status(500).json({ error: "Wallet authentication service is unavailable." });
  }
}
