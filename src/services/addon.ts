import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from '../config/manifest';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cacheService } from './cache';
import { metricsService } from './metrics';
import NyaaScraper from './nyaaScraper';
import { TorrentItem, SearchFilters, MetaInfo, StreamInfo } from '../types';

interface AddonArgs {
  type: string;
  id: string;
  extra?: Record<string, string>;
}

class AddonService {
  private nyaaScraper: NyaaScraper;
  private sukebeiScraper: NyaaScraper;
  private builder: any;

  constructor() {
    this.nyaaScraper = new NyaaScraper(config.externalServices.nyaaBaseUrl);
    this.sukebeiScraper = new NyaaScraper(config.externalServices.sukebeiBaseUrl);
    this.builder = new addonBuilder(manifest);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Catalog handler
    this.builder.defineCatalogHandler(async (args: AddonArgs) => {
      const startTime = Date.now();
      const cacheKey = `catalog:${args.type}:${args.id}:${JSON.stringify(args.extra)}`;

      try {
        // Try cache first
        const cached = await cacheService.get<{ metas: MetaInfo[] }>(cacheKey);
        if (cached) {
          metricsService.recordCacheHit();
          logger.info({ args, responseTime: Date.now() - startTime }, 'Catalog request (cached)');
          return cached;
        }

        metricsService.recordCacheMiss();

        // Build search filters from catalog parameters
        const filters: SearchFilters = {};

        if (args.extra?.search) {
          filters.query = args.extra.search;
        }

        filters.trusted = args.id.includes('trusted');

        // Map catalog type to nyaa category
        if (args.type === 'anime') {
          filters.category = '1_0'; // Anime category
        } else if (args.type === 'movie') {
          filters.category = '4_0'; // Live Action category
        }

        const options = {
          page: 1,
          limit: 50,
          sort: 'date' as const,
          order: 'desc' as const,
        };

        if (args.extra?.skip) {
          options.page = Math.floor(parseInt(args.extra.skip) / options.limit) + 1;
        }

        const searchResult = await this.nyaaScraper.search(filters, options);
        const metas = searchResult.items.map((item) => this.torrentToMeta(item));

        const result = { metas };
        await cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

        logger.info(
          {
            args,
            itemCount: metas.length,
            responseTime: Date.now() - startTime,
          },
          'Catalog request completed'
        );

        return result;
      } catch (error) {
        logger.error({ error, args }, 'Catalog request failed');
        throw error;
      }
    });

    // Meta handler
    this.builder.defineMetaHandler(async (args: AddonArgs) => {
      const startTime = Date.now();
      const cacheKey = `meta:${args.type}:${args.id}`;

      try {
        // Try cache first
        const cached = await cacheService.get<{ meta: MetaInfo }>(cacheKey);
        if (cached) {
          metricsService.recordCacheHit();
          logger.info({ args, responseTime: Date.now() - startTime }, 'Meta request (cached)');
          return cached;
        }

        metricsService.recordCacheMiss();

        // Extract search query from ID
        const id = args.id.replace('nyaa:', '');
        const searchQuery = decodeURIComponent(id);

        const filters: SearchFilters = { query: searchQuery };
        const options = { page: 1, limit: 1 };

        const searchResult = await this.nyaaScraper.search(filters, options);

        if (searchResult.items.length === 0) {
          throw new Error('Content not found');
        }

        const item = searchResult.items[0]!;
        const meta = this.torrentToMeta(item);

        const result = { meta };
        await cacheService.set(cacheKey, result, 3600); // Cache for 1 hour

        logger.info(
          {
            args,
            title: item.title,
            responseTime: Date.now() - startTime,
          },
          'Meta request completed'
        );

        return result;
      } catch (error) {
        logger.error({ error, args }, 'Meta request failed');
        throw error;
      }
    });

    // Stream handler
    this.builder.defineStreamHandler(async (args: AddonArgs) => {
      const startTime = Date.now();
      const cacheKey = `stream:${args.type}:${args.id}`;

      try {
        // Try cache first
        const cached = await cacheService.get<{ streams: StreamInfo[] }>(cacheKey);
        if (cached) {
          metricsService.recordCacheHit();
          logger.info({ args, responseTime: Date.now() - startTime }, 'Stream request (cached)');
          return cached;
        }

        metricsService.recordCacheMiss();

        // Extract search query from ID
        const id = args.id.replace('nyaa:', '');
        const searchQuery = decodeURIComponent(id);

        const filters: SearchFilters = { query: searchQuery };
        const options = {
          page: 1,
          limit: 10,
          sort: 'seeders' as const,
          order: 'desc' as const,
        };

        const searchResult = await this.nyaaScraper.search(filters, options);
        const streams = searchResult.items.map((item) => this.torrentToStream(item));

        const result = { streams };
        await cacheService.set(cacheKey, result, 1800); // Cache for 30 minutes

        logger.info(
          {
            args,
            streamCount: streams.length,
            responseTime: Date.now() - startTime,
          },
          'Stream request completed'
        );

        return result;
      } catch (error) {
        logger.error({ error, args }, 'Stream request failed');
        throw error;
      }
    });
  }

  private torrentToMeta(torrent: TorrentItem): MetaInfo {
    return {
      id: `nyaa:${encodeURIComponent(torrent.title)}`,
      type: this.getContentType(torrent.category),
      name: torrent.title,
      poster: this.generatePosterUrl(torrent),
      description: this.generateDescription(torrent),
      year: this.extractYear(torrent.title),
      genres: this.extractGenres(torrent.title, torrent.category),
    };
  }

  private torrentToStream(torrent: TorrentItem): StreamInfo {
    const qualityInfo = this.formatQualityInfo(torrent);
    const title = `${qualityInfo} | 👥${torrent.seeders}/${torrent.leechers} | 📦${torrent.size}`;

    return {
      name: config.addon.name,
      title,
      url: torrent.magnet,
      behaviorHints: {
        bingeGroup: `nyaa-${torrent.uploader}`,
        notWebReady: true,
      },
    };
  }

  private getContentType(category: string): string {
    // Check both category codes and text
    if (category.startsWith('1_') || category.toLowerCase().includes('anime')) return 'anime';
    if (category.startsWith('4_') || category.toLowerCase().includes('live action')) return 'movie';
    return 'other';
  }

  private generatePosterUrl(torrent: TorrentItem): string {
    // Generate a better placeholder poster based on the content type
    const type = this.getContentType(torrent.category);
    
    // Use different colors and styling for different content types
    const configs = {
      anime: { bg: '2c3e50', fg: 'e74c3c', emoji: '🎌' },
      movie: { bg: '34495e', fg: 'f39c12', emoji: '🎬' },
      other: { bg: '1a1a1a', fg: 'ffffff', emoji: '📁' }
    };
    
    const config = configs[type as keyof typeof configs] || configs.other;
    const title = encodeURIComponent(`${config.emoji} ${type.toUpperCase()}`);
    
    return `https://via.placeholder.com/300x450/${config.bg}/${config.fg}?text=${title}`;
  }

  private generateDescription(torrent: TorrentItem): string {
    const parts = [
      `📁 Category: ${torrent.category} - ${torrent.subcategory}`,
      `👤 Uploader: ${torrent.uploader}${torrent.trusted ? ' ✅' : ''}`,
      `📦 Size: ${torrent.size}`,
      `👥 Seeders: ${torrent.seeders} | Leechers: ${torrent.leechers}`,
      `📅 Date: ${torrent.date}`,
    ];

    if (torrent.quality) {
      parts.unshift(`🎬 Quality: ${torrent.quality}`);
    }

    if (torrent.language) {
      parts.unshift(`🗣️ Language: ${torrent.language}`);
    }

    return parts.join('\n');
  }

  private formatQualityInfo(torrent: TorrentItem): string {
    const parts = [];

    if (torrent.quality) {
      parts.push(torrent.quality);
    }

    if (torrent.language) {
      parts.push(torrent.language);
    }

    if (torrent.trusted) {
      parts.push('✅');
    }

    return parts.length > 0 ? parts.join(' ') : 'Unknown Quality';
  }

  private extractYear(title: string): string | undefined {
    // Try to extract year from common anime title patterns
    
    // Pattern: [Year] Title or (Year) Title  
    const bracketMatch = title.match(/[\[\(](20[0-2]\d)[\]\)]/);
    if (bracketMatch) return bracketMatch[1];
    
    // Pattern: Title Year or Title (Year)
    const spaceMatch = title.match(/\b(20[0-2]\d)\b/);
    if (spaceMatch) return spaceMatch[1];
    
    // Pattern: Season year like S1 2023, Season 2023, etc.
    const seasonMatch = title.match(/(?:S\d+|Season)\s+(20[0-2]\d)/i);
    if (seasonMatch) return seasonMatch[1];
    
    // Fallback to any 4-digit year between 1990-2030
    const yearMatch = title.match(/\b(19[9]\d|20[0-3]\d)\b/);
    return yearMatch ? yearMatch[0] : undefined;
  }

  private extractGenres(title: string, category: string): string[] {
    const genres: string[] = [];

    // Map categories to genres
    if (category.includes('anime')) {
      genres.push('Anime');
    }

    // Extract genres from title
    const genrePatterns = [
      { pattern: /action/i, genre: 'Action' },
      { pattern: /comedy/i, genre: 'Comedy' },
      { pattern: /drama/i, genre: 'Drama' },
      { pattern: /romance/i, genre: 'Romance' },
      { pattern: /horror/i, genre: 'Horror' },
      { pattern: /thriller/i, genre: 'Thriller' },
      { pattern: /fantasy/i, genre: 'Fantasy' },
      { pattern: /sci-?fi/i, genre: 'Sci-Fi' },
      { pattern: /mecha/i, genre: 'Mecha' },
      { pattern: /sports/i, genre: 'Sports' },
    ];

    for (const { pattern, genre } of genrePatterns) {
      if (pattern.test(title) && !genres.includes(genre)) {
        genres.push(genre);
      }
    }

    return genres;
  }

  // Public methods to expose handlers directly
  async getCatalog(args: AddonArgs): Promise<{ metas: MetaInfo[] }> {
    const startTime = Date.now();
    const cacheKey = `catalog:${args.type}:${args.id}:${JSON.stringify(args.extra)}`;

    try {
      // Try cache first
      const cached = await cacheService.get<{ metas: MetaInfo[] }>(cacheKey);
      if (cached) {
        metricsService.recordCacheHit();
        logger.info({ args, responseTime: Date.now() - startTime }, 'Catalog request (cached)');
        return cached;
      }

      metricsService.recordCacheMiss();

      // Build search filters from catalog parameters
      const filters: SearchFilters = {};

      if (args.extra?.search) {
        filters.query = args.extra.search;
      }

      if (args.extra?.genre) {
        // Map genre to search query if needed
        filters.query = filters.query ? `${filters.query} ${args.extra.genre}` : args.extra.genre;
      }

      // Set category based on catalog ID
      if (args.id === 'nyaa-anime-all' || args.id === 'nyaa-anime-trusted') {
        filters.category = '1_0'; // Anime category
        if (args.id === 'nyaa-anime-trusted') {
          filters.trusted = true; // Trusted only
        }
      } else if (args.type === 'movie') {
        filters.category = '4_0'; // Live Action category
      }

      const options = {
        page: 1,
        limit: 50,
        sort: 'date' as const,
        order: 'desc' as const,
      };

      if (args.extra?.skip) {
        options.page = Math.floor(parseInt(args.extra.skip) / options.limit) + 1;
      }

      logger.info({ 
        args, 
        filters, 
        options, 
        cacheKey 
      }, 'Processing catalog request');

      const searchResult = await this.nyaaScraper.search(filters, options);
      
      logger.info({
        args,
        searchResultCount: searchResult.items.length,
        totalPages: searchResult.pagination.totalPages,
        totalItems: searchResult.pagination.totalItems
      }, 'Search completed, converting to metas');

      const metas = searchResult.items.map((item) => this.torrentToMeta(item));

      logger.info({
        args,
        metasGenerated: metas.length,
        sampleMeta: metas[0] ? {
          id: metas[0].id,
          type: metas[0].type,
          name: metas[0].name?.substring(0, 50) + '...',
          hasYear: !!metas[0].year,
          genreCount: metas[0].genres?.length || 0
        } : null
      }, 'Metas conversion completed');

      const result = { metas };
      await cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

      logger.info({
        args,
        itemCount: metas.length,
        responseTime: Date.now() - startTime,
      }, 'Catalog request completed successfully');

      return result;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error, 
        args,
        responseTime: Date.now() - startTime
      }, 'Catalog request failed');
      
      // Return empty result instead of throwing to provide better UX
      const emptyResult = { metas: [] };
      
      // Cache empty result briefly to avoid repeated failed requests
      await cacheService.set(cacheKey, emptyResult, 60); // Cache for 1 minute
      
      return emptyResult;
    }
  }

  async getMeta(args: AddonArgs): Promise<{ meta: MetaInfo }> {
    const startTime = Date.now();
    const cacheKey = `meta:${args.type}:${args.id}`;

    try {
      // Try cache first
      const cached = await cacheService.get<{ meta: MetaInfo }>(cacheKey);
      if (cached) {
        metricsService.recordCacheHit();
        logger.info({ args, responseTime: Date.now() - startTime }, 'Meta request (cached)');
        return cached;
      }

      metricsService.recordCacheMiss();

      // Extract nyaa ID from the args.id (format: nyaa:12345)
      const nyaaId = args.id.replace('nyaa:', '');
      const filters: SearchFilters = {
        query: nyaaId
      };

      // Set category based on type
      if (args.type === 'anime') {
        filters.category = '1_0'; // Anime category
      } else if (args.type === 'movie') {
        filters.category = '4_0'; // Live Action category
      }

      const options = {
        page: 1,
        limit: 5,
        sort: 'date' as const,
        order: 'desc' as const,
      };

      const searchResult = await this.nyaaScraper.search(filters, options);

      if (searchResult.items.length === 0) {
        throw new Error('Content not found');
      }

      const item = searchResult.items[0]!;
      const meta = this.torrentToMeta(item);

      const result = { meta };
      await cacheService.set(cacheKey, result, 3600); // Cache for 1 hour

      logger.info({
        args,
        title: item.title,
        responseTime: Date.now() - startTime,
      }, 'Meta request completed');

      return result;
    } catch (error) {
      logger.error({ error, args }, 'Meta request failed');
      throw error;
    }
  }

  async getStream(args: AddonArgs): Promise<{ streams: StreamInfo[] }> {
    const startTime = Date.now();
    const cacheKey = `stream:${args.type}:${args.id}`;

    try {
      // Try cache first
      const cached = await cacheService.get<{ streams: StreamInfo[] }>(cacheKey);
      if (cached) {
        metricsService.recordCacheHit();
        logger.info({ args, responseTime: Date.now() - startTime }, 'Stream request (cached)');
        return cached;
      }

      metricsService.recordCacheMiss();

      // Extract nyaa ID from the args.id (format: nyaa:12345)
      const nyaaId = args.id.replace('nyaa:', '');
      const filters: SearchFilters = {
        query: nyaaId
      };

      // Set category based on type
      if (args.type === 'anime') {
        filters.category = '1_0'; // Anime category
      } else if (args.type === 'movie') {
        filters.category = '4_0'; // Live Action category
      }

      const options = {
        page: 1,
        limit: 10,
        sort: 'seeders' as const,
        order: 'desc' as const,
      };

      const searchResult = await this.nyaaScraper.search(filters, options);
      const streams = searchResult.items.map((item) => this.torrentToStream(item));

      const result = { streams };
      await cacheService.set(cacheKey, result, 1800); // Cache for 30 minutes

      logger.info({
        args,
        streamCount: streams.length,
        responseTime: Date.now() - startTime,
      }, 'Stream request completed');

      return result;
    } catch (error) {
      logger.error({ error, args }, 'Stream request failed');
      throw error;
    }
  }

  getInterface(): any {
    return this.builder.getInterface();
  }
}

export const addonService = new AddonService();
export default addonService;
