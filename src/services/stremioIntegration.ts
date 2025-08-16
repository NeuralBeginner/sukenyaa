import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { cacheService } from './cache';
import { 
  StremioExtension, 
  StremioManifest, 
  ExtensionCapabilities,
  IntegrationConfig,
  IntegrationStatus,
  IntegrationConflict,
  EnhancedMetaInfo
} from '../types';

class StremioIntegrationService {
  private detectedExtensions: Map<string, StremioExtension> = new Map();
  private config: IntegrationConfig['stremioExtensions'];
  private lastScanTime = 0;
  private scanInterval: NodeJS.Timeout | null = null;
  private conflicts: IntegrationConflict[] = [];

  constructor() {
    this.config = {
      enabled: process.env.STREMIO_INTEGRATION_ENABLED !== 'false',
      detectionInterval: parseInt(process.env.STREMIO_DETECTION_INTERVAL || '300000', 10), // 5 minutes
      crossReference: process.env.STREMIO_CROSS_REFERENCE !== 'false',
      metadataSync: process.env.STREMIO_METADATA_SYNC !== 'false',
      commonPorts: [3000, 8080, 7000, 11470, 11471, 11472, 11473, 11474, 11475],
      discoveryTimeout: parseInt(process.env.STREMIO_DISCOVERY_TIMEOUT || '2000', 10),
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Stremio integration disabled');
      return;
    }

    logger.info({
      detectionInterval: this.config.detectionInterval,
      crossReference: this.config.crossReference,
      metadataSync: this.config.metadataSync,
    }, 'Initializing Stremio integration service');

    // Perform initial scan
    await this.scanForExtensions();

    // Set up periodic scanning
    this.scanInterval = setInterval(() => {
      this.scanForExtensions().catch(error => {
        logger.warn({ error }, 'Periodic extension scan failed');
      });
    }, this.config.detectionInterval);

    logger.info({
      detectedCount: this.detectedExtensions.size,
    }, 'Stremio integration service initialized');
  }

  public async scanForExtensions(): Promise<void> {
    if (!this.config.enabled) return;

    const startTime = Date.now();
    logger.debug('Starting Stremio extension discovery scan');

    const newExtensions = new Map<string, StremioExtension>();
    const scanPromises: Promise<void>[] = [];

    // Scan common ports on localhost
    for (const port of this.config.commonPorts) {
      scanPromises.push(this.scanPort('localhost', port, newExtensions));
      scanPromises.push(this.scanPort('127.0.0.1', port, newExtensions));
    }

    // Scan known Stremio extension URLs from environment
    const knownUrls = process.env.STREMIO_KNOWN_EXTENSIONS?.split(',') || [];
    for (const url of knownUrls) {
      if (url.trim()) {
        scanPromises.push(this.scanUrl(url.trim(), newExtensions));
      }
    }

    // Wait for all scans to complete
    await Promise.allSettled(scanPromises);

    // Update detected extensions
    const previousCount = this.detectedExtensions.size;
    this.detectedExtensions = newExtensions;
    this.lastScanTime = Date.now();

    // Detect conflicts
    this.detectConflicts();

    const scanDuration = Date.now() - startTime;
    const detectedCount = this.detectedExtensions.size;

    logger.info({
      detectedCount,
      previousCount,
      scanDuration,
      conflicts: this.conflicts.length,
      tmdbCompatible: Array.from(this.detectedExtensions.values())
        .filter(ext => ext.capabilities.tmdbIntegration).length,
    }, 'Extension discovery scan completed');

    // Log detected extensions
    if (detectedCount > 0) {
      const extensions = Array.from(this.detectedExtensions.values());
      logger.info({
        extensions: extensions.map(ext => ({
          name: ext.name,
          version: ext.version,
          capabilities: ext.capabilities,
        })),
      }, 'Active Stremio extensions detected');
    }
  }

  private async scanPort(host: string, port: number, extensions: Map<string, StremioExtension>): Promise<void> {
    try {
      const baseUrl = `http://${host}:${port}`;
      await this.scanUrl(baseUrl, extensions);
    } catch (error) {
      // Silent failure for port scanning - most ports won't have extensions
      logger.debug({ 
        host, 
        port, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Port scan failed');
    }
  }

  private async scanUrl(baseUrl: string, extensions: Map<string, StremioExtension>): Promise<void> {
    try {
      const manifestUrl = baseUrl.endsWith('/') ? 
        `${baseUrl}manifest.json` : 
        `${baseUrl}/manifest.json`;

      const response = await axios.get<StremioManifest>(manifestUrl, {
        timeout: this.config.discoveryTimeout,
        headers: {
          'User-Agent': 'SukeNyaa/1.0.0 (+https://github.com/NeuralBeginner/sukenyaa)',
        },
      });

      const manifest = response.data;
      
      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version) {
        logger.debug({ baseUrl, manifest }, 'Invalid Stremio manifest detected');
        return;
      }

      // Skip self-detection
      if (manifest.id === 'org.sukenyaa' || manifest.name.toLowerCase().includes('sukenyaa')) {
        logger.debug({ baseUrl, manifestId: manifest.id }, 'Skipping self-detection');
        return;
      }

      const capabilities = this.analyzeCapabilities(manifest);
      
      const extension: StremioExtension = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        manifest,
        isActive: true,
        capabilities,
        baseUrl,
      };

      extensions.set(extension.id, extension);

      logger.debug({
        extensionId: extension.id,
        name: extension.name,
        baseUrl,
        capabilities,
      }, 'Stremio extension detected');

    } catch (error) {
      // Silent failure for URL scanning
      logger.debug({ 
        baseUrl, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'URL scan failed');
    }
  }

  private analyzeCapabilities(manifest: StremioManifest): ExtensionCapabilities {
    const resources = manifest.resources || [];
    const types = manifest.types || [];
    
    // Check for TMDB integration hints
    const tmdbIntegration = 
      manifest.id.toLowerCase().includes('tmdb') ||
      manifest.name.toLowerCase().includes('tmdb') ||
      manifest.description.toLowerCase().includes('tmdb') ||
      manifest.description.toLowerCase().includes('movie database');

    // Check for cross-referencing capabilities
    const crossReferencing = 
      resources.includes('meta') ||
      manifest.description.toLowerCase().includes('metadata') ||
      manifest.description.toLowerCase().includes('information');

    return {
      hasMetadata: resources.includes('meta'),
      hasStreams: resources.includes('stream'),
      hasCatalogs: resources.includes('catalog'),
      supportedTypes: types,
      tmdbIntegration,
      crossReferencing,
    };
  }

  private detectConflicts(): void {
    this.conflicts = [];
    const extensions = Array.from(this.detectedExtensions.values());

    // Check for multiple TMDB integrations
    const tmdbExtensions = extensions.filter(ext => ext.capabilities.tmdbIntegration);
    if (tmdbExtensions.length > 1) {
      for (let i = 0; i < tmdbExtensions.length; i++) {
        for (let j = i + 1; j < tmdbExtensions.length; j++) {
          const extA = tmdbExtensions[i];
          const extB = tmdbExtensions[j];
          if (extA && extB) {
            this.conflicts.push({
              type: 'metadata',
              extensionA: extA.id,
              extensionB: extB.id,
              description: 'Multiple TMDB integrations detected - may cause duplicate metadata',
              severity: 'medium',
              resolution: 'Configure TMDB priorities or disable duplicate integrations',
            });
          }
        }
      }
    }

    // Check for catalog conflicts (same types)
    const catalogExtensions = extensions.filter(ext => ext.capabilities.hasCatalogs);
    for (let i = 0; i < catalogExtensions.length; i++) {
      for (let j = i + 1; j < catalogExtensions.length; j++) {
        const extA = catalogExtensions[i];
        const extB = catalogExtensions[j];
        if (extA && extB) {
          const commonTypes = extA.capabilities.supportedTypes
            .filter(type => extB.capabilities.supportedTypes.includes(type));
          
          if (commonTypes.length > 0) {
            this.conflicts.push({
              type: 'catalog',
              extensionA: extA.id,
              extensionB: extB.id,
              description: `Overlapping catalog types: ${commonTypes.join(', ')}`,
              severity: 'low',
              resolution: 'Consider organizing catalogs by priority or specialization',
            });
          }
        }
      }
    }
  }

  public async crossReferenceMetadata(meta: EnhancedMetaInfo): Promise<EnhancedMetaInfo> {
    if (!this.config.enabled || !this.config.crossReference) {
      return meta;
    }

    const references: EnhancedMetaInfo['crossReferences'] = [];
    
    // Try to find references in other extensions
    const metadataExtensions = Array.from(this.detectedExtensions.values())
      .filter(ext => ext.capabilities.hasMetadata && ext.baseUrl);

    for (const extension of metadataExtensions) {
      try {
        const reference = await this.findMetaReference(extension, meta);
        if (reference) {
          references.push(reference);
        }
      } catch (error) {
        logger.debug({ 
          extensionId: extension.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Cross-reference lookup failed');
      }
    }

    if (references.length > 0) {
      logger.info({
        metaId: meta.id,
        referencesFound: references.length,
        extensions: references.map(ref => ref.extensionId),
      }, 'Cross-references found for metadata');

      return {
        ...meta,
        crossReferences: references,
      };
    }

    return meta;
  }

  private async findMetaReference(
    extension: StremioExtension, 
    meta: EnhancedMetaInfo
  ): Promise<{ extensionId: string; metaId: string; confidence: number } | null> {
    if (!extension.baseUrl) return null;

    try {
      // Try searching by title
      const searchUrl = `${extension.baseUrl}/catalog/${meta.type}/search.json`;
      const response = await axios.get(searchUrl, {
        params: { search: meta.name },
        timeout: 3000,
      });

      const results = response.data?.metas || [];
      
      // Find potential matches
      for (const result of results) {
        const confidence = this.calculateMatchConfidence(meta, result);
        if (confidence > 0.7) {
          return {
            extensionId: extension.id,
            metaId: result.id,
            confidence,
          };
        }
      }

      return null;
    } catch (error) {
      // Silent failure for cross-referencing
      return null;
    }
  }

  private calculateMatchConfidence(meta1: any, meta2: any): number {
    let confidence = 0;
    let factors = 0;

    // Title similarity
    if (meta1.name && meta2.name) {
      const similarity = this.calculateStringSimilarity(
        meta1.name.toLowerCase(),
        meta2.name.toLowerCase()
      );
      confidence += similarity * 0.4;
      factors++;
    }

    // Year match
    if (meta1.year && meta2.year && meta1.year === meta2.year) {
      confidence += 0.3;
      factors++;
    }

    // Type match
    if (meta1.type === meta2.type) {
      confidence += 0.1;
      factors++;
    }

    // TMDB ID match (if available)
    if (meta1.tmdbId && meta2.tmdbId && meta1.tmdbId === meta2.tmdbId) {
      confidence += 0.5;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0]![i] = i;
    for (let j = 0; j <= len2; j++) matrix[j]![0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j - 1]![i]! + 1,
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i - 1]! + cost
        );
      }
    }

    const distance = matrix[len2]![len1]!;
    const maxLength = Math.max(len1, len2);
    return 1 - distance / maxLength;
  }

  public getDetectedExtensions(): StremioExtension[] {
    return Array.from(this.detectedExtensions.values());
  }

  public getConflicts(): IntegrationConflict[] {
    return this.conflicts;
  }

  public getTMDBCompatibleExtensions(): StremioExtension[] {
    return Array.from(this.detectedExtensions.values())
      .filter(ext => ext.capabilities.tmdbIntegration);
  }

  public async getStatus(): Promise<IntegrationStatus['extensions']> {
    const extensions = Array.from(this.detectedExtensions.values());
    
    return {
      detected: extensions.length,
      active: extensions.filter(ext => ext.isActive).length,
      tmdbCompatible: extensions.filter(ext => ext.capabilities.tmdbIntegration).length,
      lastScan: new Date(this.lastScanTime).toISOString(),
      conflicts: this.conflicts,
    };
  }

  public async refreshExtensions(): Promise<void> {
    logger.info('Manual extension refresh requested');
    await this.scanForExtensions();
  }

  public stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      logger.info('Stremio integration service stopped');
    }
  }
}

export const stremioIntegrationService = new StremioIntegrationService();
export default stremioIntegrationService;