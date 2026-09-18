import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMissionState } from "../src/api/missions.js";
import { applyCors } from "./_cors.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!applyCors(request, response)) return;
  await getMissionState(request, response);
}
