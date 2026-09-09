import type { VercelRequest, VercelResponse } from "@vercel/node";

export function applyCors(request: VercelRequest, response: VercelResponse): boolean {
  const origin = request.headers.origin;
  const allowedOrigin = origin === "https://localhost" || origin === "https://seekerpulse.xyz"
    ? origin
    : "https://seekerpulse.xyz";

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
