import { readFile } from "node:fs/promises";
import type { DappCatalogProvider } from "./provider.js";
import type { DiscoveredDapp } from "./types.js";

export class VerifiedFileCatalogProvider implements DappCatalogProvider {
  constructor(private readonly filePath: string) {}

  async discoverDapps(): Promise<DiscoveredDapp[]> {
    const content = await readFile(this.filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("Verified dApp import must contain a JSON array.");
    }
    return parsed as DiscoveredDapp[];
  }
}
