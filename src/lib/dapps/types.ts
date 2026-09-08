export type DappStatus = "active" | "inactive" | "archived" | "pending" | "unknown";

export interface DiscoveredRelease {
  version?: string;
  versionCode?: string;
  packageName?: string;
  releaseDate?: string | null;
  metadataUrl?: string;
  apkUrl?: string;
}

export interface DiscoveredDapp {
  source: string;
  sourceId?: string;
  sourceUrl?: string | null;
  metadataUri?: string | null;
  verifiedAt?: string | null;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  website?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  packageName?: string | null;
  developerName?: string | null;
  developerWebsite?: string | null;
  status?: DappStatus | string;
  isSeekerCompatible?: boolean;
  isVerified?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  releases?: DiscoveredRelease[];
  categories?: string[];
  tags?: string[];
}

export interface DappRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  website: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  packageName: string | null;
  deepLink: string | null;
  developerName: string | null;
  developerWebsite: string | null;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  isSeekerCompatible: boolean;
  rating: number | null;
  reviewCount: number | null;
  pulseScore: number | null;
  source: string;
  sourceId: string | null;
  sourceUrl: string | null;
  metadataUri: string | null;
  verifiedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
  releases: Array<{ version: string; packageName: string | null; releaseDate: Date | null }>; 
}

export interface DappSearchIntent {
  intent: string;
  assets: string[];
  categories: string[];
  keywords: string[];
  limit: number;
}

export interface DappSearchFilters {
  query?: string;
  category?: string;
  tag?: string;
  activeOnly?: boolean;
  seekerCompatibleOnly?: boolean;
  minPulseScore?: number;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "pulseScore" | "updatedAt" | "name";
}

export interface DappValidationResult {
  valid: boolean;
  reason?: string;
}

export interface DappRecommendation {
  dappId: string;
  reason: string;
  relevance: number;
}

export interface DappRecommendationResponse {
  answer: string;
  recommendations: Array<{ dappId: string; reason: string; relevance: number }>;
}
