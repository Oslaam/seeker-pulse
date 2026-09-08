import type { VercelRequest, VercelResponse } from "@vercel/node";
import { lookup } from "../src/api.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await lookup(request, response);
}
