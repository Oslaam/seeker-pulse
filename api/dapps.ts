import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listDapps } from "../src/api/dapps.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await listDapps(request, response);
}
