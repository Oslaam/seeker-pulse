import type { DiscoveredDapp, DappValidationResult } from "./types.js";

const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

export function validateDiscoveredDapp(input: unknown): DappValidationResult {
  if (!input || typeof input !== "object") return { valid: false, reason: "Invalid metadata" };

  const dapp = input as Partial<DiscoveredDapp>;
  if (typeof dapp.source !== "string" || !dapp.source.trim()) return { valid: false, reason: "Missing source" };
  if (typeof dapp.name !== "string" || !dapp.name.trim()) return { valid: false, reason: "Missing name" };
  if (dapp.packageName != null && (typeof dapp.packageName !== "string" || !PACKAGE_NAME_RE.test(dapp.packageName.trim()))) {
    return { valid: false, reason: "Invalid package name" };
  }
  if (dapp.sourceId != null && typeof dapp.sourceId !== "string") return { valid: false, reason: "Invalid source ID" };
  return { valid: true };
}