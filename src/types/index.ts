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
