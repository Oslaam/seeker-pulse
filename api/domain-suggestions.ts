import type { VercelRequest, VercelResponse } from "@vercel/node";
import { domainSuggestions } from "../src/api.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await domainSuggestions(request, response);
}
