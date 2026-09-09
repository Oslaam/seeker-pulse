import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDapp } from "../../src/api/dapps.js";
import { applyCors } from "../_cors.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!applyCors(request, response)) return;
  await getDapp({ query: { id: request.query.id } }, response);
}
