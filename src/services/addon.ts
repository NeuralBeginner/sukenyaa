import { addonBuilder } from 'stremio-addon-sdk';
import { manifest } from '../config/manifest';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cacheService } from './cache';
import { metricsService } from './metrics';
import { configurationService } from './config';
import { integrationService } from './integrationService';
import NyaaScraper from './nyaaScraper';
import { TorrentItem, SearchFilters, MetaInfo, StreamInfo, EnhancedMetaInfo } from '../types';

interface AddonArgs {
  type: string;
  id: string;
  extra?: Record<string, string>;
}

class AddonService {
  private nyaaScraper: NyaaScraper;
  private sukebeiScraper: NyaaScraper;
  private builder: any;
  private torrentCache: Map<string, TorrentItem> = new Map(); // Cache for torrent data

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

        const metas = await Promise.all(
          filteredItems.map(async (item) => {
            const basicMeta = this.torrentToMeta(item);
            // Enhanced metadata through integrations (TMDB, cross-references)
            if (userConfig.enablePosters || userConfig.enableSynopsis || userConfig.enableTags) {
              return await integrationService.enhanceMetadata(item, basicMeta);
            }
            return basicMeta;
          })
        );

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
        let meta = this.torrentToMeta(item);
        
        // Enhanced metadata through integrations (TMDB, cross-references)
        const userConfig = await configurationService.getUserConfiguration();
        if (userConfig.enablePosters || userConfig.enableSynopsis || userConfig.enableTags) {
          meta = await integrationService.enhanceMetadata(item, meta);
        }

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

  private cacheTorrentData(id: string, torrent: TorrentItem): void {
    this.torrentCache.set(id, torrent);
    
    // Limit cache size to prevent memory issues
    if (this.torrentCache.size > 1000) {
      const firstKey = this.torrentCache.keys().next().value;
      if (firstKey) {
        this.torrentCache.delete(firstKey);
      }
    }
  }

  private getCachedTorrentData(id: string): TorrentItem | null {
    return this.torrentCache.get(id) || null;
  }

  private torrentToMeta(torrent: TorrentItem): MetaInfo {
    // Use the actual torrent ID instead of encoded title
    const id = `nyaa:${torrent.id}`;
    
    // Cache the full torrent data for meta/stream requests
    this.cacheTorrentData(torrent.id, torrent);
    
    return {
      id,
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
    // Generate high-quality poster URLs for mobile compatibility
    const type = this.getContentType(torrent.category);
    const title = torrent.title;
    
    // Try to extract series/movie name for poster lookup
    const cleanTitle = this.extractCleanTitle(title);
    
    // For now, use improved placeholders that are more visually appealing
    // These will work reliably on all devices including Android
    if (type === 'anime') {
      // Anime placeholder - modern blue gradient design
      return this.generateModernPlaceholder(cleanTitle, '#2196F3', '#1976D2', '🎭');
    } else if (type === 'movie') {
      // Movie placeholder - modern red gradient design  
      return this.generateModernPlaceholder(cleanTitle, '#F44336', '#D32F2F', '🎬');
    } else {
      // Other content placeholder - modern green gradient design
      return this.generateModernPlaceholder(cleanTitle, '#4CAF50', '#388E3C', '📦');
    }
  }

  private extractCleanTitle(title: string): string {
    // Extract clean title for display (remove brackets, quality info, etc.)
    let cleanTitle = title;
    
    // Remove common patterns
    cleanTitle = cleanTitle.replace(/\[.*?\]/g, ''); // Remove [brackets]
    cleanTitle = cleanTitle.replace(/\(.*?\)/g, ''); // Remove (parentheses)
    cleanTitle = cleanTitle.replace(/\b(1080p|720p|480p|4K|BD|WEB|DVDRip|BDRip)\b/gi, '');
    cleanTitle = cleanTitle.replace(/\b(x264|x265|H264|H265|HEVC|AVC)\b/gi, '');
    cleanTitle = cleanTitle.replace(/\b(AAC|AC3|DTS|FLAC|MP3)\b/gi, '');
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
    
    // Limit length for display
    if (cleanTitle.length > 30) {
      cleanTitle = cleanTitle.substring(0, 30) + '...';
    }
    
    return cleanTitle || 'Unknown Title';
  }

  private generateModernPlaceholder(title: string, primaryColor: string, secondaryColor: string, icon: string): string {
    // Create a modern, gradient-based placeholder that looks professional
    const width = 300;
    const height = 450;
    
    // Encode title for SVG
    const encodedTitle = title.replace(/[<>&"']/g, (char) => {
      const map: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[char] || char;
    });
    
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      
      <!-- Background gradient -->
      <rect width="100%" height="100%" fill="url(#grad)" rx="12" ry="12"/>
      
      <!-- Overlay pattern for texture -->
      <rect width="100%" height="100%" fill="rgba(255,255,255,0.05)" rx="12" ry="12" 
            style="opacity: 0.7; background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.1) 2px, rgba(255,255,255,.1) 4px);"/>
      
      <!-- Icon -->
      <text x="50%" y="35%" font-family="Arial, sans-serif" font-size="48" 
            fill="rgba(255,255,255,0.9)" text-anchor="middle" dy=".3em" filter="url(#shadow)">${icon}</text>
      
      <!-- Title -->
      <text x="50%" y="65%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            font-size="18" font-weight="600" fill="white" text-anchor="middle" dy=".3em" filter="url(#shadow)">
        <tspan x="50%" dy="0">${encodedTitle.length > 20 ? encodedTitle.substring(0, 20) : encodedTitle}</tspan>
        ${encodedTitle.length > 20 ? `<tspan x="50%" dy="1.2em">${encodedTitle.substring(20, 40)}</tspan>` : ''}
      </text>
      
      <!-- Quality indicator if available -->
      <rect x="10" y="10" width="60" height="24" fill="rgba(0,0,0,0.7)" rx="12" ry="12"/>
      <text x="40" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            fill="white" text-anchor="middle" dy=".3em">HD</text>
      
      <!-- Bottom bar for branding -->
      <rect x="0" y="${height - 30}" width="100%" height="30" fill="rgba(0,0,0,0.3)" rx="0 0 12 12"/>
      <text x="50%" y="${height - 15}" font-family="Arial, sans-serif" font-size="11" 
            fill="rgba(255,255,255,0.8)" text-anchor="middle" dy=".3em">SukeNyaa</text>
    </svg>`;
    
    // Return as data URL
    return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
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

      // Extract torrent ID from args.id (format: nyaa:torrentId)
      const torrentId = args.id.replace('nyaa:', '');
      
      // First try to get from torrent cache
      let torrent = this.getCachedTorrentData(torrentId);
      
      if (!torrent) {
        // If not in cache, try to search for it
        // Use the torrent ID to search, or fall back to partial search
        const filters: SearchFilters = {};
        
        // Set category based on type
        if (args.type === 'anime') {
          filters.category = '1_0'; // Anime category
        } else if (args.type === 'movie') {
          filters.category = '4_0'; // Live Action category
        }

        const options = {
          page: 1,
          limit: 20, // Get more results to find the right one
          sort: 'date' as const,
          order: 'desc' as const,
        };

        const searchResult = await this.nyaaScraper.search(filters, options);
        
        // Try to find the specific torrent by ID
        const foundTorrent = searchResult.items.find(item => item.id === torrentId);
        torrent = foundTorrent || null;
        
        if (!torrent && searchResult.items.length > 0) {
          // Fallback to first result if exact match not found
          torrent = searchResult.items[0]!;
          logger.warn({ 
            args, 
            requestedId: torrentId, 
            foundId: torrent.id 
          }, 'Exact torrent not found, using fallback');
        }
      }

      if (!torrent) {
        throw new Error('Content not found');
      }

      const meta = this.torrentToMeta(torrent);

      const result = { meta };
      await cacheService.set(cacheKey, result, 3600); // Cache for 1 hour

      logger.info({
        args,
        title: torrent.title,
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

      // Extract torrent ID from args.id (format: nyaa:torrentId)
      const torrentId = args.id.replace('nyaa:', '');
      
      // First try to get from torrent cache
      let torrent = this.getCachedTorrentData(torrentId);
      let streams: StreamInfo[] = [];
      
      if (torrent) {
        // If we have the exact torrent, create stream for it
        streams = [this.torrentToStream(torrent)];
      } else {
        // If not in cache, search for similar content
        const filters: SearchFilters = {};
        
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
        
        // Try to find the specific torrent by ID, or use all results
        const specificTorrent = searchResult.items.find(item => item.id === torrentId);
        if (specificTorrent) {
          streams = [this.torrentToStream(specificTorrent)];
        } else {
          // Fallback: return all results as potential streams
          streams = searchResult.items.map((item) => this.torrentToStream(item));
        }
      }

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
