import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDapp } from "../../src/api/dapps.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await getDapp({ query: { id: request.query.id } }, response);
}
