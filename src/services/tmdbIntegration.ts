import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { cacheService } from './cache';
import { 
  TMDBMetadata, 
  TMDBSearchResult, 
  TMDBGenre, 
  IntegrationConfig,
  EnhancedMetaInfo,
  MetaInfo,
  TorrentItem
} from '../types';

class TMDBIntegrationService {
  private axiosInstance: AxiosInstance;
  private config: IntegrationConfig['tmdb'];
  private genres: Map<number, string> = new Map();
  private isInitialized = false;
  private rateLimitReset = 0;
  private rateLimitRemaining = 40; // TMDB default limit
  private lastRequestTime = 0;

  constructor() {
    this.config = {
      enabled: process.env.TMDB_ENABLED !== 'false',
      apiKey: process.env.TMDB_API_KEY || undefined,
      baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      imageBaseUrl: process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
      priority: 1, // High priority for metadata
      cacheTimeout: parseInt(process.env.TMDB_CACHE_TIMEOUT || '3600', 10),
      rateLimitMs: parseInt(process.env.TMDB_RATE_LIMIT_MS || '250', 10),
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SukeNyaa/1.0.0 (+https://github.com/NeuralBeginner/sukenyaa)',
      },
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.apiKey) {
      logger.info({
        enabled: this.config.enabled,
        hasApiKey: !!this.config.apiKey,
      }, 'TMDB integration not configured - using fallback metadata');
      return;
    }

    try {
      await this.loadGenres();
      await this.testConnection();
      this.isInitialized = true;
      
      logger.info({
        baseUrl: this.config.baseUrl,
        genreCount: this.genres.size,
      }, 'TMDB integration initialized successfully');
      
    } catch (error) {
      logger.error({ error }, 'Failed to initialize TMDB integration - using fallback metadata');
      this.config.enabled = false;
    }
  }

  private async loadGenres(): Promise<void> {
    try {
      const cacheKey = 'tmdb:genres';
      const cached = await cacheService.get<TMDBGenre[]>(cacheKey);
      
      if (cached) {
        cached.forEach(genre => this.genres.set(genre.id, genre.name));
        logger.debug({ genreCount: this.genres.size }, 'Loaded TMDB genres from cache');
        return;
      }

      await this.enforceRateLimit();
      const response = await this.axiosInstance.get('/genre/movie/list', {
        params: { api_key: this.config.apiKey },
      });

      const genres: TMDBGenre[] = response.data.genres;
      genres.forEach(genre => this.genres.set(genre.id, genre.name));
      
      await cacheService.set(cacheKey, genres, 86400); // Cache for 24 hours
      
      logger.debug({ genreCount: this.genres.size }, 'Loaded TMDB genres from API');
      
    } catch (error) {
      logger.warn({ error }, 'Failed to load TMDB genres - proceeding without genre mapping');
    }
  }

  private async testConnection(): Promise<void> {
    await this.enforceRateLimit();
    await this.axiosInstance.get('/configuration', {
      params: { api_key: this.config.apiKey },
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.config.rateLimitMs) {
      const delay = this.config.rateLimitMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  public async isAvailable(): Promise<boolean> {
    return this.config.enabled && this.isInitialized;
  }

  public async enhanceMetadata(torrent: TorrentItem, originalMeta: MetaInfo): Promise<EnhancedMetaInfo> {
    if (!await this.isAvailable()) {
      logger.debug({ torrentTitle: torrent.title }, 'TMDB not available - using original metadata');
      return this.createFallbackMeta(originalMeta);
    }

    try {
      const tmdbData = await this.searchTMDB(torrent.title, originalMeta.type);
      
      if (!tmdbData) {
        logger.debug({ 
          torrentTitle: torrent.title,
          type: originalMeta.type,
        }, 'No TMDB match found - using original metadata');
        return this.createFallbackMeta(originalMeta);
      }

      const enhancedMeta = await this.createEnhancedMeta(originalMeta, tmdbData);
      
      logger.info({
        torrentTitle: torrent.title,
        tmdbId: tmdbData.id,
        tmdbTitle: tmdbData.title,
        integrationSource: enhancedMeta.integrationSource,
      }, 'Successfully enhanced metadata with TMDB data');
      
      return enhancedMeta;
      
    } catch (error) {
      logger.warn({ 
        error,
        torrentTitle: torrent.title,
      }, 'Failed to enhance metadata with TMDB - using original');
      
      return this.createFallbackMeta(originalMeta);
    }
  }

  private async searchTMDB(title: string, type: string): Promise<TMDBMetadata | null> {
    const cleanTitle = this.cleanTitleForSearch(title);
    const cacheKey = `tmdb:search:${type}:${cleanTitle}`;
    
    // Try cache first
    const cached = await cacheService.get<TMDBMetadata | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      await this.enforceRateLimit();
      
      const endpoint = type === 'movie' ? '/search/movie' : '/search/multi';
      const response = await this.axiosInstance.get<TMDBSearchResult>(endpoint, {
        params: {
          api_key: this.config.apiKey,
          query: cleanTitle,
          include_adult: false,
          page: 1,
        },
      });

      const results = response.data.results;
      if (results.length === 0) {
        await cacheService.set(cacheKey, null, this.config.cacheTimeout);
        return null;
      }

      // Find best match based on title similarity and type
      const bestMatch = this.findBestMatch(cleanTitle, results, type);
      
      if (bestMatch) {
        // Get detailed information
        const detailedData = await this.getDetailedMetadata(bestMatch.id, type);
        await cacheService.set(cacheKey, detailedData, this.config.cacheTimeout);
        return detailedData;
      }

      await cacheService.set(cacheKey, null, this.config.cacheTimeout);
      return null;
      
    } catch (error) {
      logger.warn({ error, title: cleanTitle, type }, 'TMDB search failed');
      await cacheService.set(cacheKey, null, 300); // Cache failures for 5 minutes
      return null;
    }
  }

  private async getDetailedMetadata(tmdbId: number, type: string): Promise<TMDBMetadata> {
    const cacheKey = `tmdb:details:${type}:${tmdbId}`;
    
    const cached = await cacheService.get<TMDBMetadata>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.enforceRateLimit();
    
    const endpoint = type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const response = await this.axiosInstance.get<TMDBMetadata>(endpoint, {
      params: {
        api_key: this.config.apiKey,
        append_to_response: 'credits,videos,external_ids',
      },
    });

    const data = response.data;
    await cacheService.set(cacheKey, data, this.config.cacheTimeout);
    
    return data;
  }

  private cleanTitleForSearch(title: string): string {
    // Remove common anime/torrent patterns for better TMDB matching
    let cleaned = title
      .replace(/\[.*?\]/g, '') // Remove [brackets]
      .replace(/\(.*?\)/g, '') // Remove (parentheses)
      .replace(/\b(1080p|720p|480p|4K|BD|WEB|DVDRip|BDRip|WEBRip)\b/gi, '')
      .replace(/\b(x264|x265|H264|H265|HEVC|AVC)\b/gi, '')
      .replace(/\b(AAC|AC3|DTS|FLAC|MP3)\b/gi, '')
      .replace(/\b(MULTI|DUAL|SUB|DUB)\b/gi, '')
      .replace(/\bS\d+E\d+\b/gi, '') // Remove season/episode info
      .replace(/\b\d{4}\b/g, '') // Remove years
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Handle common anime title patterns
    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ');
      cleaned = parts[0]?.trim() || cleaned;
    }

    return cleaned;
  }

  private findBestMatch(searchTitle: string, results: TMDBMetadata[], type: string): TMDBMetadata | null {
    if (results.length === 0) return null;

    // Score each result based on title similarity and relevance
    const scored = results.map(result => {
      let score = 0;
      const resultTitle = (result.title || result.original_title || '').toLowerCase();
      const searchLower = searchTitle.toLowerCase();

      // Exact match gets highest score
      if (resultTitle === searchLower) {
        score += 100;
      } else if (resultTitle.includes(searchLower) || searchLower.includes(resultTitle)) {
        score += 80;
      } else {
        // Calculate string similarity (simplified)
        const similarity = this.calculateSimilarity(searchLower, resultTitle);
        score += similarity * 60;
      }

      // Boost popular items slightly
      score += Math.min(result.popularity / 100, 10);

      // Boost items with higher ratings
      score += result.vote_average;

      // Prefer movies for movie content, but don't exclude TV shows
      if (type === 'movie' && !result.video) {
        score += 5;
      }

      return { ...result, score };
    });

    // Sort by score and return the best match
    scored.sort((a, b) => b.score - a.score);
    
    // Only return if the score is reasonable
    const bestMatch = scored[0];
    return bestMatch && bestMatch.score > 30 ? bestMatch : null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation based on common words
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    let commonWords = 0;
    for (const word1 of words1) {
      if (word1.length > 2 && words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        commonWords++;
      }
    }
    
    return commonWords / Math.max(words1.length, words2.length);
  }

  private async createEnhancedMeta(originalMeta: MetaInfo, tmdbData: TMDBMetadata): Promise<EnhancedMetaInfo> {
    const enhancedMeta: EnhancedMetaInfo = {
      ...originalMeta,
      tmdbId: tmdbData.id,
      tmdbRating: tmdbData.vote_average,
      tmdbPopularity: tmdbData.popularity,
      integrationSource: 'hybrid',
      lastUpdated: new Date().toISOString(),
    };

    // Enhanced poster (prefer TMDB if available)
    if (tmdbData.poster_path) {
      enhancedMeta.enhancedPoster = `${this.config.imageBaseUrl}/w500${tmdbData.poster_path}`;
      enhancedMeta.poster = enhancedMeta.enhancedPoster;
    }

    // Enhanced background
    if (tmdbData.backdrop_path) {
      enhancedMeta.enhancedBackground = `${this.config.imageBaseUrl}/w1280${tmdbData.backdrop_path}`;
      enhancedMeta.background = enhancedMeta.enhancedBackground;
    }

    // Enhanced description (combine TMDB overview with original torrent info)
    if (tmdbData.overview) {
      enhancedMeta.enhancedDescription = tmdbData.overview;
      enhancedMeta.description = `${tmdbData.overview}\n\n---\n\n${originalMeta.description}`;
    }

    // Enhanced genres
    if (tmdbData.genre_ids || tmdbData.genres) {
      const genreIds = tmdbData.genres ? 
        tmdbData.genres.map(g => g.id) : 
        tmdbData.genre_ids || [];
      
      const genreNames = genreIds
        .map(id => this.genres.get(id))
        .filter(name => name) as string[];
      
      if (genreNames.length > 0) {
        enhancedMeta.enhancedGenres = genreNames;
        enhancedMeta.genres = [...(originalMeta.genres || []), ...genreNames]
          .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
      }
    }

    // Add IMDB rating if available
    if (tmdbData.imdb_id) {
      enhancedMeta.imdbRating = tmdbData.vote_average.toString();
    }

    // Extract year from release date
    if (tmdbData.release_date) {
      enhancedMeta.year = tmdbData.release_date.split('-')[0];
    }

    return enhancedMeta;
  }

  private createFallbackMeta(originalMeta: MetaInfo): EnhancedMetaInfo {
    return {
      ...originalMeta,
      integrationSource: 'nyaa',
      lastUpdated: new Date().toISOString(),
    };
  }

  public async getStatus(): Promise<{
    available: boolean;
    configured: boolean;
    initialized: boolean;
    genreCount: number;
    rateLimit: {
      remaining: number;
      resetTime: string;
    };
  }> {
    return {
      available: await this.isAvailable(),
      configured: this.config.enabled && !!this.config.apiKey,
      initialized: this.isInitialized,
      genreCount: this.genres.size,
      rateLimit: {
        remaining: this.rateLimitRemaining,
        resetTime: new Date(this.rateLimitReset).toISOString(),
      },
    };
  }

  public async clearCache(): Promise<void> {
    // This would be implemented to clear TMDB-specific cache entries
    logger.info('TMDB cache clearing requested');
  }
}

export const tmdbIntegrationService = new TMDBIntegrationService();
export default tmdbIntegrationService;