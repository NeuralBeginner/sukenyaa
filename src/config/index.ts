import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    trustProxy: process.env.TRUST_PROXY === 'true',
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  scraping: {
    delayMs: parseInt(process.env.SCRAPING_DELAY_MS || '1000', 10),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
    maxRetries: 3,
    userAgent: 'SukeNyaa/1.0.0 (Stremio Addon)',
  },
  contentFilter: {
    enableNsfwFilter: process.env.ENABLE_NSFW_FILTER !== 'false',
    strictMinorContentExclusion: process.env.STRICT_MINOR_CONTENT_EXCLUSION !== 'false',
    blockedCategories: ['1_3'], // Sukebei real/Junior Idol category
    blockedKeywords: [
      'loli',
      'shota',
      'junior',
      'child',
      'kid',
      'underage',
      'elementary',
      'school girl',
      'school boy',
      'jc',
      'js',
      'u15',
      'u12',
      'u18',
      'young',
      'teen',
      'minor',
    ],
    trustedUploadersOnly: false,
  },
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10),
  },
  addon: {
    name: process.env.ADDON_NAME || 'SukeNyaa',
    description:
      process.env.ADDON_DESCRIPTION ||
      'Unofficial Stremio addon for nyaa.si and sukebei.nyaa.si content',
    version: process.env.ADDON_VERSION || '1.0.0',
    logo: process.env.ADDON_LOGO || 'https://nyaa.si/static/img/avatar/default.png',
    background: process.env.ADDON_BACKGROUND || 'https://nyaa.si/static/img/logo.png',
  },
  externalServices: {
    nyaaBaseUrl: process.env.NYAA_BASE_URL || 'https://nyaa.si',
    sukebeiBaseUrl: process.env.SUKEBEI_BASE_URL || 'https://sukebei.nyaa.si',
  },
} as const;

export default config;
