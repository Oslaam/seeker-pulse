import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findDapps } from "../../src/api/dapps.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await findDapps(request, response);
}
