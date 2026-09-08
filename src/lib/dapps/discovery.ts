import type { DappCatalogProvider } from "./provider.js";
import type { DiscoveredDapp } from "./types.js";

/**
 * The official publishing repository documents how publishers submit app and
 * release metadata, but it does not provide a public complete catalog feed.
 * Keep this provider empty until a record comes from a verified source.
 */
export class VerifiedSolanaMobileCatalogProvider implements DappCatalogProvider {
  async discoverDapps(): Promise<DiscoveredDapp[]> {
    return [];
  }
}
