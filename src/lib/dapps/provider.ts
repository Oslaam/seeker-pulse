import type { DiscoveredDapp } from "./types.js";

export interface DappCatalogProvider {
  discoverDapps(): Promise<DiscoveredDapp[]>;
}
