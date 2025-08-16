export interface TorrentItem {
  id: string;
  title: string;
  magnet: string;
  size: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  downloads: number;
  date: string;
  category: string;
  subcategory: string;
  uploader: string;
  trusted: boolean;
  remake: boolean;
  quality?: string | undefined;
  language?: string | undefined;
  resolution?: string | undefined;
}

export interface SearchFilters {
  query?: string | undefined;
  category?: string | undefined;
  subcategory?: string | undefined;
  quality?: string | undefined;
  language?: string | undefined;
  minSize?: number | undefined;
  maxSize?: number | undefined;
  minSeeders?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  trusted?: boolean | undefined;
  remake?: boolean | undefined;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sort?: 'date' | 'size' | 'seeders' | 'leechers' | 'downloads' | 'title';
  order?: 'asc' | 'desc';
}

export interface SearchResult {
  items: TorrentItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface StreamInfo {
  name: string;
  title: string;
  url: string;
  behaviorHints?: {
    bingeGroup?: string;
    countryWhitelist?: string[];
    notWebReady?: boolean;
  };
}

export interface MetaInfo {
  id: string;
  type: string;
  name: string;
  poster?: string | undefined;
  background?: string | undefined;
  description?: string | undefined;
  year?: string | undefined;
  imdbRating?: string | undefined;
  genres?: string[] | undefined;
  director?: string[] | undefined;
  cast?: string[] | undefined;
  runtime?: string | undefined;
  language?: string | undefined;
  country?: string | undefined;
  awards?: string | undefined;
  website?: string | undefined;
  trailer?: string | undefined;
  videos?:
    | Array<{
        id: string;
        title: string;
        season?: number;
        episode?: number;
        thumbnail?: string;
        overview?: string;
        released?: string;
      }>
    | undefined;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    nyaa: 'up' | 'down' | 'unknown';
    sukebei: 'up' | 'down' | 'unknown';
    redis?: 'up' | 'down' | 'unknown';
  };
  metrics: {
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

export interface RateLimitInfo {
  windowMs: number;
  maxRequests: number;
  currentRequests: number;
  resetTime: Date;
}

export interface ScrapingConfig {
  baseUrl: string;
  delayMs: number;
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
}

export interface ContentFilterConfig {
  enableNsfwFilter: boolean;
  strictMinorContentExclusion: boolean;
  blockedCategories: string[];
  blockedKeywords: string[];
  trustedUploadersOnly: boolean;
}

// TMDB Integration Types
export interface TMDBMetadata {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: TMDBGenre[];
  original_language: string;
  original_title: string;
  popularity: number;
  adult: boolean;
  video?: boolean;
  runtime?: number;
  budget?: number;
  revenue?: number;
  status?: string;
  tagline?: string;
  homepage?: string;
  imdb_id?: string;
  production_companies?: TMDBProductionCompany[];
  production_countries?: TMDBProductionCountry[];
  spoken_languages?: TMDBSpokenLanguage[];
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TMDBProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TMDBSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TMDBSearchResult {
  page: number;
  results: TMDBMetadata[];
  total_pages: number;
  total_results: number;
}

// Stremio Extension Detection Types
export interface StremioExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  manifest: StremioManifest;
  isActive: boolean;
  capabilities: ExtensionCapabilities;
  baseUrl?: string;
}

export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  resources: string[];
  types: string[];
  catalogs?: ManifestCatalog[];
  idPrefixes?: string[];
  background?: string;
  logo?: string;
  contactEmail?: string;
}

export interface ManifestCatalog {
  type: string;
  id: string;
  name: string;
  extra?: ManifestExtra[];
}

export interface ManifestExtra {
  name: string;
  options?: string[];
  isRequired?: boolean;
}

export interface ExtensionCapabilities {
  hasMetadata: boolean;
  hasStreams: boolean;
  hasCatalogs: boolean;
  supportedTypes: string[];
  tmdbIntegration: boolean;
  crossReferencing: boolean;
}

// Enhanced Metadata with Integration
export interface EnhancedMetaInfo extends MetaInfo {
  tmdbId?: number;
  tmdbRating?: number;
  tmdbPopularity?: number;
  enhancedPoster?: string;
  enhancedBackground?: string;
  enhancedDescription?: string;
  enhancedGenres?: string[];
  integrationSource?: 'tmdb' | 'nyaa' | 'hybrid';
  lastUpdated?: string;
  crossReferences?: Array<{
    extensionId: string;
    metaId: string;
    confidence: number;
  }> | undefined;
}

// Integration Configuration
export interface IntegrationConfig {
  tmdb: {
    enabled: boolean;
    apiKey?: string | undefined;
    baseUrl: string;
    imageBaseUrl: string;
    priority: number;
    cacheTimeout: number;
    rateLimitMs: number;
  };
  stremioExtensions: {
    enabled: boolean;
    detectionInterval: number;
    crossReference: boolean;
    metadataSync: boolean;
    commonPorts: number[];
    discoveryTimeout: number;
  };
  fallback: {
    useOriginalOnFailure: boolean;
    retryAttempts: number;
    retryDelayMs: number;
  };
}

// Integration Status and Diagnostics
export interface IntegrationStatus {
  tmdb: {
    available: boolean;
    configured: boolean;
    lastCheck: string;
    rateLimit: {
      remaining: number;
      resetTime: string;
    };
    errorCount: number;
    lastError?: string | undefined;
  };
  extensions: {
    detected: number;
    active: number;
    tmdbCompatible: number;
    lastScan: string;
    conflicts: IntegrationConflict[];
  };
}

export interface IntegrationConflict {
  type: 'metadata' | 'stream' | 'catalog';
  extensionA: string;
  extensionB: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}
