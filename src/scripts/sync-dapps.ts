import { syncDapps } from "../lib/dapps/sync.js";
import { VerifiedSolanaMobileCatalogProvider } from "../lib/dapps/discovery.js";
import { VerifiedFileCatalogProvider } from "../lib/dapps/file-provider.js";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const fileArgumentIndex = process.argv.indexOf("--file");
const filePath = fileArgumentIndex >= 0 ? process.argv[fileArgumentIndex + 1] : undefined;
const provider = filePath
  ? new VerifiedFileCatalogProvider(path.resolve(filePath))
  : new VerifiedSolanaMobileCatalogProvider();

try {
  console.log(`DApp sync started.\nSource: ${filePath ? "verified-import" : "solana-mobile"}\nMode: ${dryRun ? "dry-run" : "write"}`);
  const summary = await syncDapps(provider, { dryRun });
  console.log([
    "DApp sync completed.",
    `Discovered: ${summary.discovered}`,
    `Valid: ${summary.valid}`,
    `Invalid: ${summary.invalid}`,
    `Created: ${summary.created}`,
    `Updated: ${summary.updated}`,
    `Unchanged: ${summary.unchanged}`,
    `Deactivated: ${summary.deactivated}`,
    `Releases: ${summary.releases}`,
    `Errors: ${summary.errors}`,
  ].join("\n"));
} catch (error) {
  console.error("DApp sync failed", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}