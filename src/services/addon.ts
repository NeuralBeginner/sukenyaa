import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from '../config/manifest';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cacheService } from './cache';
import { metricsService } from './metrics';
import { configurationService } from './config';
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
      
      try {
        // Get user configuration
        const userConfig = await configurationService.getUserConfiguration();
        
        // Include user config in cache key to ensure personalized results
        const cacheKey = `catalog:${args.type}:${args.id}:${JSON.stringify(args.extra)}:${JSON.stringify(userConfig)}`;

        // Try cache first
        const cached = await cacheService.get<{ metas: MetaInfo[] }>(cacheKey);
        if (cached) {
          metricsService.recordCacheHit();
          if (userConfig.enableDetailedLogging) {
            logger.info({ args, responseTime: Date.now() - startTime }, 'Catalog request (cached)');
          }
          return cached;
        }

        metricsService.recordCacheMiss();

        // Build search filters from catalog parameters and user preferences
        const filters: SearchFilters = {};

        if (args.extra?.search) {
          filters.query = args.extra.search;
        }

        if (args.extra?.genre) {
          // Map genre to search query if needed
          filters.query = filters.query ? `${filters.query} ${args.extra.genre}` : args.extra.genre;
        }

        if (args.extra?.quality) {
          filters.quality = args.extra.quality;
        }

        if (args.extra?.language) {
          filters.language = args.extra.language;
        }

        if (args.extra?.trusted) {
          filters.trusted = args.extra.trusted === 'true';
        }

        // Apply user configuration
        if (!filters.trusted) { // Only apply user preference if not explicitly set
          filters.trusted = args.id.includes('trusted') || userConfig.trustedUploadersOnly;
        }

        // Map catalog type to nyaa category
        if (args.type === 'anime') {
          filters.category = '1_0'; // Anime category
        } else if (args.type === 'movie') {
          filters.category = '4_0'; // Live Action category
        }

        const options = {
          page: 1,
          limit: Math.min(userConfig.maxResults, 75), // Respect user preference
          sort: userConfig.defaultSort as 'date' | 'seeders' | 'size' | 'title',
          order: userConfig.defaultOrder as 'asc' | 'desc',
        };

        if (args.extra?.skip) {
          options.page = Math.floor(parseInt(args.extra.skip) / options.limit) + 1;
        }

        const searchResult = await this.nyaaScraper.search(filters, options);
        
        // Apply additional user-based filtering and sorting
        let filteredItems = searchResult.items;
        
        // Filter by preferred quality if specified
        if (userConfig.preferredQuality.length > 0) {
          filteredItems = this.filterByQuality(filteredItems, userConfig.preferredQuality);
        }
        
        // Filter by preferred languages if specified
        if (userConfig.preferredLanguages.length > 0) {
          filteredItems = this.filterByLanguage(filteredItems, userConfig.preferredLanguages);
        }

        const metas = filteredItems.map((item) => this.torrentToMeta(item));

        // Handle empty results with user-friendly message
        if (metas.length === 0) {
          const emptyMessage = this.generateEmptyResultsMessage(args, userConfig);
          logger.warn(
            {
              args,
              userConfig: userConfig.enableDetailedLogging ? userConfig : undefined,
              message: emptyMessage,
            },
            'Catalog request returned no results'
          );
          
          // Return empty catalog with helpful meta information
          return { 
            metas: [{
              id: 'sukenyaa:empty',
              type: args.type,
              name: '🔍 No Results Found',
              poster: 'https://nyaa.si/static/img/avatar/default.png',
              description: emptyMessage,
              year: new Date().getFullYear().toString(),
              genres: ['Info'],
            }] 
          };
        }

        const result = { metas };
        await cacheService.set(cacheKey, result, userConfig.cacheTimeout);

        if (userConfig.enableDetailedLogging) {
          logger.info(
            {
              args,
              userConfig: { 
                trustedOnly: userConfig.trustedUploadersOnly,
                maxResults: userConfig.maxResults,
                sort: userConfig.defaultSort,
                order: userConfig.defaultOrder,
              },
              itemCount: metas.length,
              responseTime: Date.now() - startTime,
            },
            'Catalog request completed with user preferences'
          );
        } else {
          logger.info(
            {
              args,
              itemCount: metas.length,
              responseTime: Date.now() - startTime,
            },
            'Catalog request completed'
          );
        }

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
    // Generate Android-compatible poster URLs
    // Use a reliable data URL that always works on mobile devices
    const type = this.getContentType(torrent.category);
    
    // Create different placeholder images based on content type
    if (type === 'anime') {
      // Anime placeholder - blue color scheme
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmY1NWE4Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn4+5IEFuaW1lPC90ZXh0Pgo8L3N2Zz4=';
    } else if (type === 'movie') {
      // Movie placeholder - red color scheme
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGM0NDQ0Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn46sIE1vdmllPC90ZXh0Pgo8L3N2Zz4=';
    } else {
      // Other content placeholder - green color scheme
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNWNiODVjIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5OhIE90aGVyPC90ZXh0Pgo8L3N2Zz4=';
    }
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
    const bracketMatch = title.match(/[[(](20[0-2]\d)[\])]/);
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

  private filterByQuality(items: TorrentItem[], preferredQualities: string[]): TorrentItem[] {
    // If no quality preference, return all items
    if (preferredQualities.length === 0) {
      return items;
    }

    // Sort items to prioritize preferred qualities
    return items.sort((a, b) => {
      const aQuality = a.quality || '';
      const bQuality = b.quality || '';
      
      const aIndex = preferredQualities.findIndex(q => aQuality.includes(q));
      const bIndex = preferredQualities.findIndex(q => bQuality.includes(q));
      
      // Items with preferred quality come first
      if (aIndex !== -1 && bIndex === -1) return -1;
      if (aIndex === -1 && bIndex !== -1) return 1;
      
      // Both have preferred quality, sort by preference order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // Neither has preferred quality, maintain original order
      return 0;
    });
  }

  private filterByLanguage(items: TorrentItem[], preferredLanguages: string[]): TorrentItem[] {
    // If no language preference, return all items
    if (preferredLanguages.length === 0) {
      return items;
    }

    // Sort items to prioritize preferred languages
    return items.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      
      const aHasPreferred = preferredLanguages.some(lang => 
        aTitle.includes(lang.toLowerCase()) || 
        aTitle.includes('dual audio') ||
        aTitle.includes('multi') ||
        (lang === 'Japanese' && (aTitle.includes('jp') || aTitle.includes('jpn'))) ||
        (lang === 'English' && (aTitle.includes('eng') || aTitle.includes('en')))
      );
      
      const bHasPreferred = preferredLanguages.some(lang => 
        bTitle.includes(lang.toLowerCase()) || 
        bTitle.includes('dual audio') ||
        bTitle.includes('multi') ||
        (lang === 'Japanese' && (bTitle.includes('jp') || bTitle.includes('jpn'))) ||
        (lang === 'English' && (bTitle.includes('eng') || bTitle.includes('en')))
      );
      
      // Items with preferred language come first
      if (aHasPreferred && !bHasPreferred) return -1;
      if (!aHasPreferred && bHasPreferred) return 1;
      
      // Maintain original order for equal priority
      return 0;
    });
  }

  private generateEmptyResultsMessage(args: AddonArgs, userConfig: any): string {
    const reasons = [];
    
    if (args.extra?.search) {
      reasons.push(`search term "${args.extra.search}"`);
    }
    
    if (userConfig.trustedUploadersOnly) {
      reasons.push('trusted uploaders only filter');
    }
    
    if (userConfig.preferredQuality.length > 0) {
      reasons.push(`quality filter (${userConfig.preferredQuality.join(', ')})`);
    }
    
    if (userConfig.preferredLanguages.length > 0) {
      reasons.push(`language filter (${userConfig.preferredLanguages.join(', ')})`);
    }
    
    const baseMessage = `No ${args.type} content found`;
    
    if (reasons.length > 0) {
      return `${baseMessage} matching your criteria: ${reasons.join(', ')}. Try adjusting your search terms or configuration settings.`;
    }
    
    return `${baseMessage}. This could be due to network issues with nyaa.si or temporary unavailability. Please try again later.`;
  }

  // Public methods to expose handlers directly
  async getCatalog(args: AddonArgs): Promise<{ metas: MetaInfo[] }> {
    const startTime = Date.now();

    // Log all catalog requests for debugging Android issues
    logger.info({ 
      args,
      userAgent: 'unknown', // Will be added from server middleware 
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9)
    }, 'Catalog request received');

    // Get user configuration first for cacheKey
    const userConfig = await configurationService.getUserConfiguration();
    
    // Include user config in cache key to ensure personalized results
    const cacheKey = `catalog:${args.type}:${args.id}:${JSON.stringify(args.extra)}:${JSON.stringify(userConfig)}`;

    try {
      // Try cache first
      const cached = await cacheService.get<{ metas: MetaInfo[] }>(cacheKey);
      if (cached) {
        metricsService.recordCacheHit();
        if (userConfig.enableDetailedLogging) {
          logger.info({ args, responseTime: Date.now() - startTime }, 'Catalog request (cached)');
        }
        return cached;
      }

      metricsService.recordCacheMiss();

      // Build search filters from catalog parameters and user preferences
      const filters: SearchFilters = {};

      if (args.extra?.search) {
        filters.query = args.extra.search;
      }

      if (args.extra?.genre) {
        // Map genre to search query if needed
        filters.query = filters.query ? `${filters.query} ${args.extra.genre}` : args.extra.genre;
      }

      if (args.extra?.quality) {
        filters.quality = args.extra.quality;
      }

      if (args.extra?.language) {
        filters.language = args.extra.language;
      }

      if (args.extra?.trusted) {
        filters.trusted = args.extra.trusted === 'true';
      }

      // Apply user configuration
      if (!filters.trusted) { // Only apply user preference if not explicitly set
        filters.trusted = args.id.includes('trusted') || userConfig.trustedUploadersOnly;
      }

      // Set category based on catalog ID
      if (args.id === 'nyaa-anime-all' || args.id === 'nyaa-anime-trusted') {
        filters.category = '1_0'; // Anime category
      } else if (args.type === 'movie') {
        filters.category = '4_0'; // Live Action category
      }

      const options = {
        page: 1,
        limit: Math.min(userConfig.maxResults, 75), // Respect user preference
        sort: userConfig.defaultSort as 'date' | 'seeders' | 'size' | 'title',
        order: userConfig.defaultOrder as 'asc' | 'desc',
      };

      if (args.extra?.skip) {
        options.page = Math.floor(parseInt(args.extra.skip) / options.limit) + 1;
      }

      if (userConfig.enableDetailedLogging) {
        logger.info({ 
          args, 
          filters, 
          options, 
          userConfig: {
            trustedOnly: userConfig.trustedUploadersOnly,
            maxResults: userConfig.maxResults,
            sort: userConfig.defaultSort,
            order: userConfig.defaultOrder,
          },
          cacheKey 
        }, 'Processing catalog request with user preferences');
      }

      const searchResult = await this.nyaaScraper.search(filters, options);
      
      // Apply additional user-based filtering and sorting
      let filteredItems = searchResult.items;
      
      // Filter by preferred quality if specified
      if (userConfig.preferredQuality.length > 0) {
        filteredItems = this.filterByQuality(filteredItems, userConfig.preferredQuality);
      }
      
      // Filter by preferred languages if specified
      if (userConfig.preferredLanguages.length > 0) {
        filteredItems = this.filterByLanguage(filteredItems, userConfig.preferredLanguages);
      }

      if (userConfig.enableDetailedLogging) {
        logger.info({
          args,
          searchResultCount: searchResult.items.length,
          filteredCount: filteredItems.length,
          totalPages: searchResult.pagination.totalPages,
          totalItems: searchResult.pagination.totalItems
        }, 'Search completed, applying user filters');
      }

      const metas = filteredItems.map((item) => this.torrentToMeta(item));

      // Handle empty results with user-friendly message
      if (metas.length === 0) {
        const emptyMessage = this.generateEmptyResultsMessage(args, userConfig);
        logger.warn(
          {
            args,
            userConfig: userConfig.enableDetailedLogging ? userConfig : undefined,
            message: emptyMessage,
          },
          'Catalog request returned no results'
        );
        
        // Return empty catalog with helpful meta information
        return { 
          metas: [{
            id: 'sukenyaa:empty',
            type: args.type,
            name: '🔍 No Results Found',
            poster: 'https://nyaa.si/static/img/avatar/default.png',
            description: emptyMessage,
            year: new Date().getFullYear().toString(),
            genres: ['Info'],
          }] 
        };
      }

      if (userConfig.enableDetailedLogging) {
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
        }, 'Metas conversion completed with user preferences');
      }

      const result = { metas };
      await cacheService.set(cacheKey, result, userConfig.cacheTimeout);

      if (userConfig.enableDetailedLogging) {
        logger.info({
          args,
          itemCount: metas.length,
          responseTime: Date.now() - startTime,
          userConfigApplied: {
            trustedOnly: userConfig.trustedUploadersOnly,
            maxResults: userConfig.maxResults,
            sort: userConfig.defaultSort,
            order: userConfig.defaultOrder,
          }
        }, 'Catalog request completed successfully with user preferences');
      } else {
        logger.info({
          args,
          itemCount: metas.length,
          responseTime: Date.now() - startTime,
        }, 'Catalog request completed successfully');
      }

      return result;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error, 
        args,
        responseTime: Date.now() - startTime,
        isAndroidRequest: 'unknown', // Will be set from server middleware
        troubleshooting: {
          checkNetworkConnectivity: 'Verify nyaa.si is accessible',
          checkStremioVersion: 'Ensure latest Stremio Android app',
          checkConfiguration: 'Try resetting addon configuration',
          checkLogs: 'Enable detailed logging for more info'
        }
      }, 'Catalog request failed - Android troubleshooting info included');
      
      // Return a helpful error meta instead of empty for better debugging
      const errorMeta = {
        id: 'sukenyaa:error',
        type: args.type,
        name: '❌ Request Failed',
        poster: 'https://nyaa.si/static/img/avatar/default.png',
        description: `Error loading catalog: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your network connection and try again.`,
        year: new Date().getFullYear().toString(),
        genres: ['Error'],
      };
      
      const errorResult = { metas: [errorMeta] };
      
      // Cache error result briefly to avoid repeated failed requests
      await cacheService.set(cacheKey, errorResult, 60); // Cache for 1 minute
      
      return errorResult;
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
