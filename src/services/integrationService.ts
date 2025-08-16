import { logger } from '../utils/logger';
import { tmdbIntegrationService } from './tmdbIntegration';
import { stremioIntegrationService } from './stremioIntegration';
import { cacheService } from './cache';
import { 
  EnhancedMetaInfo,
  MetaInfo,
  TorrentItem,
  IntegrationStatus,
  IntegrationConfig
} from '../types';

class IntegrationService {
  private config: IntegrationConfig;
  private isInitialized = false;

  constructor() {
    this.config = {
      tmdb: {
        enabled: process.env.TMDB_ENABLED !== 'false',
        apiKey: process.env.TMDB_API_KEY || undefined,
        baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
        imageBaseUrl: process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
        priority: parseInt(process.env.TMDB_PRIORITY || '1', 10),
        cacheTimeout: parseInt(process.env.TMDB_CACHE_TIMEOUT || '3600', 10),
        rateLimitMs: parseInt(process.env.TMDB_RATE_LIMIT_MS || '250', 10),
      },
      stremioExtensions: {
        enabled: process.env.STREMIO_INTEGRATION_ENABLED !== 'false',
        detectionInterval: parseInt(process.env.STREMIO_DETECTION_INTERVAL || '300000', 10),
        crossReference: process.env.STREMIO_CROSS_REFERENCE !== 'false',
        metadataSync: process.env.STREMIO_METADATA_SYNC !== 'false',
        commonPorts: [3000, 8080, 7000, 11470, 11471, 11472, 11473, 11474, 11475],
        discoveryTimeout: parseInt(process.env.STREMIO_DISCOVERY_TIMEOUT || '2000', 10),
      },
      fallback: {
        useOriginalOnFailure: process.env.FALLBACK_USE_ORIGINAL !== 'false',
        retryAttempts: parseInt(process.env.FALLBACK_RETRY_ATTEMPTS || '2', 10),
        retryDelayMs: parseInt(process.env.FALLBACK_RETRY_DELAY_MS || '1000', 10),
      },
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    logger.info({
      tmdbEnabled: this.config.tmdb.enabled,
      stremioIntegrationEnabled: this.config.stremioExtensions.enabled,
      crossReference: this.config.stremioExtensions.crossReference,
      metadataSync: this.config.stremioExtensions.metadataSync,
    }, 'Initializing integration services');

    // Services initialize themselves
    this.isInitialized = true;

    logger.info('Integration services initialized - automatic metadata enhancement enabled');
  }

  /**
   * Main metadata enhancement method that orchestrates all integrations
   */
  public async enhanceMetadata(torrent: TorrentItem, originalMeta: MetaInfo): Promise<EnhancedMetaInfo> {
    const startTime = Date.now();
    
    try {
      logger.debug({
        torrentTitle: torrent.title,
        metaType: originalMeta.type,
      }, 'Starting metadata enhancement pipeline');

      // Step 1: Try TMDB enhancement (highest priority)
      let enhancedMeta = await this.enhanceWithTMDB(torrent, originalMeta);
      
      // Step 2: Cross-reference with other Stremio extensions
      if (this.config.stremioExtensions.crossReference) {
        enhancedMeta = await this.enhanceWithCrossReferences(enhancedMeta);
      }

      // Step 3: Apply final enhancements and validation
      enhancedMeta = await this.applyFinalEnhancements(enhancedMeta, torrent);

      const enhancementTime = Date.now() - startTime;

      logger.info({
        torrentTitle: torrent.title,
        integrationSource: enhancedMeta.integrationSource,
        hasTMDBData: !!enhancedMeta.tmdbId,
        hasCrossReferences: !!(enhancedMeta.crossReferences?.length),
        enhancementTime,
      }, 'Metadata enhancement completed successfully');

      return enhancedMeta;

    } catch (error) {
      logger.warn({
        error,
        torrentTitle: torrent.title,
        enhancementTime: Date.now() - startTime,
      }, 'Metadata enhancement failed - using fallback');

      return this.createFallbackMeta(originalMeta);
    }
  }

  private async enhanceWithTMDB(torrent: TorrentItem, originalMeta: MetaInfo): Promise<EnhancedMetaInfo> {
    if (!this.config.tmdb.enabled) {
      logger.debug('TMDB integration disabled - skipping TMDB enhancement');
      return this.createBasicEnhancedMeta(originalMeta);
    }

    try {
      const tmdbEnhanced = await tmdbIntegrationService.enhanceMetadata(torrent, originalMeta);
      
      if (tmdbEnhanced.integrationSource === 'hybrid') {
        logger.debug({
          torrentTitle: torrent.title,
          tmdbId: tmdbEnhanced.tmdbId,
          tmdbRating: tmdbEnhanced.tmdbRating,
        }, 'Successfully enhanced with TMDB data');
      }

      return tmdbEnhanced;

    } catch (error) {
      logger.warn({
        error,
        torrentTitle: torrent.title,
      }, 'TMDB enhancement failed - proceeding with original metadata');

      return this.createBasicEnhancedMeta(originalMeta);
    }
  }

  private async enhanceWithCrossReferences(meta: EnhancedMetaInfo): Promise<EnhancedMetaInfo> {
    if (!this.config.stremioExtensions.enabled || !this.config.stremioExtensions.crossReference) {
      return meta;
    }

    try {
      const crossReferenced = await stremioIntegrationService.crossReferenceMetadata(meta);
      
      if (crossReferenced.crossReferences?.length) {
        logger.debug({
          metaId: meta.id,
          crossReferences: crossReferenced.crossReferences.length,
          extensions: crossReferenced.crossReferences.map(ref => ref.extensionId),
        }, 'Successfully added cross-references');
      }

      return crossReferenced;

    } catch (error) {
      logger.debug({
        error,
        metaId: meta.id,
      }, 'Cross-reference enhancement failed - proceeding without references');

      return meta;
    }
  }

  private async applyFinalEnhancements(meta: EnhancedMetaInfo, torrent: TorrentItem): Promise<EnhancedMetaInfo> {
    // Apply intelligent fallbacks and quality improvements
    
    // Ensure we have a poster - use generated one if no TMDB poster
    if (!meta.poster || meta.poster.includes('data:image/svg+xml')) {
      // Keep the original generated poster if no better one is available
    }

    // Enhance description with torrent-specific information
    if (meta.description && !meta.description.includes(torrent.uploader)) {
      const torrentInfo = `\n\n📁 Source: ${torrent.category} - ${torrent.subcategory}\n👤 Uploader: ${torrent.uploader}${torrent.trusted ? ' ✅' : ''}\n👥 Seeders: ${torrent.seeders} | Leechers: ${torrent.leechers}`;
      meta.description += torrentInfo;
    }

    // Add quality information to genres if not present
    if (torrent.quality && !meta.genres?.includes(torrent.quality)) {
      meta.genres = [...(meta.genres || []), torrent.quality];
    }

    return meta;
  }

  private createBasicEnhancedMeta(originalMeta: MetaInfo): EnhancedMetaInfo {
    return {
      ...originalMeta,
      integrationSource: 'nyaa',
      lastUpdated: new Date().toISOString(),
    };
  }

  private createFallbackMeta(originalMeta: MetaInfo): EnhancedMetaInfo {
    logger.info({
      metaId: originalMeta.id,
      fallbackEnabled: this.config.fallback.useOriginalOnFailure,
    }, 'Using fallback metadata due to integration failures');

    return this.createBasicEnhancedMeta(originalMeta);
  }

  /**
   * Get comprehensive status of all integrations
   */
  public async getIntegrationStatus(): Promise<IntegrationStatus> {
    const tmdbStatus = await tmdbIntegrationService.getStatus();
    const extensionsStatus = await stremioIntegrationService.getStatus();

    return {
      tmdb: {
        available: tmdbStatus.available,
        configured: tmdbStatus.configured,
        lastCheck: new Date().toISOString(),
        rateLimit: tmdbStatus.rateLimit,
        errorCount: 0, // TODO: Implement error tracking
        lastError: undefined,
      },
      extensions: extensionsStatus,
    };
  }

  /**
   * Force refresh of all integrations
   */
  public async refreshIntegrations(): Promise<void> {
    logger.info('Refreshing all integrations');
    
    try {
      await Promise.all([
        stremioIntegrationService.refreshExtensions(),
        // TMDB doesn't need explicit refresh
      ]);
      
      logger.info('All integrations refreshed successfully');
    } catch (error) {
      logger.warn({ error }, 'Some integrations failed to refresh');
    }
  }

  /**
   * Get diagnostic information for troubleshooting
   */
  public async getDiagnostics(): Promise<{
    config: IntegrationConfig;
    status: IntegrationStatus;
    detectedExtensions: any[];
    conflicts: any[];
    recommendations: string[];
  }> {
    const status = await this.getIntegrationStatus();
    const detectedExtensions = stremioIntegrationService.getDetectedExtensions();
    const conflicts = stremioIntegrationService.getConflicts();

    const recommendations: string[] = [];

    // Generate recommendations
    if (!this.config.tmdb.enabled) {
      recommendations.push('Enable TMDB integration for enhanced metadata');
    } else if (!this.config.tmdb.apiKey) {
      recommendations.push('Configure TMDB API key for better metadata quality');
    }

    if (conflicts.length > 0) {
      recommendations.push(`Resolve ${conflicts.length} detected extension conflicts`);
    }

    if (detectedExtensions.length === 0) {
      recommendations.push('No other Stremio extensions detected - consider installing complementary addons');
    }

    const tmdbExtensions = detectedExtensions.filter(ext => ext.capabilities.tmdbIntegration);
    if (tmdbExtensions.length > 1) {
      recommendations.push('Multiple TMDB integrations detected - consider consolidating to avoid conflicts');
    }

    return {
      config: this.config,
      status,
      detectedExtensions: detectedExtensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        capabilities: ext.capabilities,
        baseUrl: ext.baseUrl,
      })),
      conflicts,
      recommendations,
    };
  }

  /**
   * Clear all integration caches
   */
  public async clearIntegrationCache(): Promise<void> {
    logger.info('Clearing all integration caches');
    
    try {
      await Promise.all([
        tmdbIntegrationService.clearCache(),
        cacheService.clear(), // Clear general cache which includes integration data
      ]);
      
      logger.info('Integration caches cleared successfully');
    } catch (error) {
      logger.warn({ error }, 'Failed to clear some integration caches');
    }
  }

  public isEnabled(): boolean {
    return this.config.tmdb.enabled || this.config.stremioExtensions.enabled;
  }

  public stop(): void {
    stremioIntegrationService.stop();
    logger.info('Integration services stopped');
  }
}

export const integrationService = new IntegrationService();
export default integrationService;