import type { VercelRequest, VercelResponse } from "@vercel/node";
import { skrBalance } from "../../src/api/wallet.js";
import { applyCors } from "../_cors.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!applyCors(request, response)) return;
  await skrBalance(request, response);
}
