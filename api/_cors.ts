import type { VercelRequest, VercelResponse } from "@vercel/node";

export function applyCors(request: VercelRequest, response: VercelResponse): boolean {
  const origin = request.headers.origin;
  const allowedOrigins = new Set([
    "https://seekerpulse.xyz",
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://seekerpulse.xyz";

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return false;
  }
  return true;
}
