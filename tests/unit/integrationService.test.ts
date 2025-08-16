import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { integrationService } from '../../src/services/integrationService';
import { tmdbIntegrationService } from '../../src/services/tmdbIntegration';
import { stremioIntegrationService } from '../../src/services/stremioIntegration';

// Mock the integration services
jest.mock('../../src/services/tmdbIntegration');
jest.mock('../../src/services/stremioIntegration');

const mockTmdbService = tmdbIntegrationService as jest.Mocked<typeof tmdbIntegrationService>;
const mockStremioService = stremioIntegrationService as jest.Mocked<typeof stremioIntegrationService>;

describe('Integration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Metadata Enhancement', () => {
    test('should enhance metadata with TMDB when available', async () => {
      // Mock TMDB enhancement
      const mockTorrent = {
        id: '1',
        title: 'Test Anime [1080p]',
        magnet: 'magnet:test',
        size: '1GB',
        sizeBytes: 1000000000,
        seeders: 10,
        leechers: 2,
        downloads: 100,
        date: '2024-01-01',
        category: '1_0',
        subcategory: 'Anime',
        uploader: 'test-user',
        trusted: true,
        remake: false,
        quality: '1080p',
      };

      const mockOriginalMeta = {
        id: 'nyaa:1',
        type: 'anime',
        name: 'Test Anime [1080p]',
        description: 'Original description',
      };

      const mockEnhancedMeta = {
        ...mockOriginalMeta,
        tmdbId: 12345,
        tmdbRating: 8.5,
        enhancedPoster: 'https://image.tmdb.org/poster.jpg',
        enhancedDescription: 'Enhanced TMDB description',
        integrationSource: 'hybrid' as const,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      mockTmdbService.enhanceMetadata.mockResolvedValue(mockEnhancedMeta);
      mockStremioService.crossReferenceMetadata.mockResolvedValue(mockEnhancedMeta);

      const result = await integrationService.enhanceMetadata(mockTorrent, mockOriginalMeta);

      expect(mockTmdbService.enhanceMetadata).toHaveBeenCalledWith(mockTorrent, mockOriginalMeta);
      expect(result.integrationSource).toBe('hybrid');
      expect(result.tmdbId).toBe(12345);
      expect(result.enhancedPoster).toBe('https://image.tmdb.org/poster.jpg');
    });

    test('should fall back to original metadata when TMDB fails', async () => {
      const mockTorrent = {
        id: '1',
        title: 'Test Anime [1080p]',
        magnet: 'magnet:test',
        size: '1GB',
        sizeBytes: 1000000000,
        seeders: 10,
        leechers: 2,
        downloads: 100,
        date: '2024-01-01',
        category: '1_0',
        subcategory: 'Anime',
        uploader: 'test-user',
        trusted: true,
        remake: false,
        quality: '1080p',
      };

      const mockOriginalMeta = {
        id: 'nyaa:1',
        type: 'anime',
        name: 'Test Anime [1080p]',
        description: 'Original description',
      };

      mockTmdbService.enhanceMetadata.mockRejectedValue(new Error('TMDB API error'));
      mockStremioService.crossReferenceMetadata.mockResolvedValue({
        ...mockOriginalMeta,
        integrationSource: 'nyaa' as const,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      });

      const result = await integrationService.enhanceMetadata(mockTorrent, mockOriginalMeta);

      expect(result.integrationSource).toBe('nyaa');
      expect(result.tmdbId).toBeUndefined();
    });

    test('should add cross-references when available', async () => {
      const mockTorrent = {
        id: '1',
        title: 'Test Anime [1080p]',
        magnet: 'magnet:test',
        size: '1GB',
        sizeBytes: 1000000000,
        seeders: 10,
        leechers: 2,
        downloads: 100,
        date: '2024-01-01',
        category: '1_0',
        subcategory: 'Anime',
        uploader: 'test-user',
        trusted: true,
        remake: false,
        quality: '1080p',
      };

      const mockOriginalMeta = {
        id: 'nyaa:1',
        type: 'anime',
        name: 'Test Anime [1080p]',
        description: 'Original description',
      };

      const mockEnhancedWithReferences = {
        ...mockOriginalMeta,
        integrationSource: 'nyaa' as const,
        lastUpdated: '2024-01-01T00:00:00.000Z',
        crossReferences: [
          {
            extensionId: 'com.example.tmdb',
            metaId: 'tmdb:12345',
            confidence: 0.95,
          },
        ],
      };

      mockTmdbService.enhanceMetadata.mockResolvedValue({
        ...mockOriginalMeta,
        integrationSource: 'nyaa' as const,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      });
      mockStremioService.crossReferenceMetadata.mockResolvedValue(mockEnhancedWithReferences);

      const result = await integrationService.enhanceMetadata(mockTorrent, mockOriginalMeta);

      expect(result.crossReferences).toHaveLength(1);
      expect(result.crossReferences?.[0]?.extensionId).toBe('com.example.tmdb');
      expect(result.crossReferences?.[0]?.confidence).toBe(0.95);
    });
  });

  describe('Integration Status', () => {
    test('should return comprehensive integration status', async () => {
      const mockTmdbStatus = {
        available: true,
        configured: true,
        initialized: true,
        genreCount: 20,
        rateLimit: {
          remaining: 38,
          resetTime: '2024-01-01T01:00:00.000Z',
        },
      };

      const mockExtensionsStatus = {
        detected: 2,
        active: 2,
        tmdbCompatible: 1,
        lastScan: '2024-01-01T00:00:00.000Z',
        conflicts: [],
      };

      mockTmdbService.getStatus.mockResolvedValue(mockTmdbStatus);
      mockStremioService.getStatus.mockResolvedValue(mockExtensionsStatus);

      const status = await integrationService.getIntegrationStatus();

      expect(status.tmdb.available).toBe(true);
      expect(status.tmdb.configured).toBe(true);
      expect(status.extensions.detected).toBe(2);
      expect(status.extensions.tmdbCompatible).toBe(1);
    });
  });

  describe('Diagnostics', () => {
    test('should provide helpful recommendations', async () => {
      mockTmdbService.getStatus.mockResolvedValue({
        available: false,
        configured: false,
        initialized: false,
        genreCount: 0,
        rateLimit: {
          remaining: 40,
          resetTime: '1970-01-01T00:00:00.000Z',
        },
      });

      mockStremioService.getStatus.mockResolvedValue({
        detected: 0,
        active: 0,
        tmdbCompatible: 0,
        lastScan: '2024-01-01T00:00:00.000Z',
        conflicts: [],
      });

      mockStremioService.getDetectedExtensions.mockReturnValue([]);
      mockStremioService.getConflicts.mockReturnValue([]);

      const diagnostics = await integrationService.getDiagnostics();

      expect(diagnostics.recommendations).toContain('Configure TMDB API key for better metadata quality');
      expect(diagnostics.recommendations).toContain('No other Stremio extensions detected - consider installing complementary addons');
    });

    test('should detect conflicts and provide recommendations', async () => {
      const mockConflicts = [
        {
          type: 'metadata' as const,
          extensionA: 'ext1',
          extensionB: 'ext2',
          description: 'Multiple TMDB integrations detected',
          severity: 'medium' as const,
          resolution: 'Configure priorities',
        },
      ];

      mockStremioService.getConflicts.mockReturnValue(mockConflicts);
      mockStremioService.getDetectedExtensions.mockReturnValue([
        {
          id: 'ext1',
          name: 'TMDB Extension 1',
          version: '1.0.0',
          description: 'TMDB integration',
          manifest: {} as any,
          isActive: true,
          capabilities: {
            hasMetadata: true,
            hasStreams: false,
            hasCatalogs: false,
            supportedTypes: ['movie'],
            tmdbIntegration: true,
            crossReferencing: true,
          },
        },
        {
          id: 'ext2',
          name: 'TMDB Extension 2',
          version: '1.0.0',
          description: 'Another TMDB integration',
          manifest: {} as any,
          isActive: true,
          capabilities: {
            hasMetadata: true,
            hasStreams: false,
            hasCatalogs: false,
            supportedTypes: ['movie'],
            tmdbIntegration: true,
            crossReferencing: true,
          },
        },
      ]);

      mockTmdbService.getStatus.mockResolvedValue({
        available: true,
        configured: true,
        initialized: true,
        genreCount: 20,
        rateLimit: {
          remaining: 40,
          resetTime: '2024-01-01T01:00:00.000Z',
        },
      });

      mockStremioService.getStatus.mockResolvedValue({
        detected: 2,
        active: 2,
        tmdbCompatible: 2,
        lastScan: '2024-01-01T00:00:00.000Z',
        conflicts: mockConflicts,
      });

      const diagnostics = await integrationService.getDiagnostics();

      expect(diagnostics.conflicts).toHaveLength(1);
      expect(diagnostics.recommendations).toContain('Resolve 1 detected extension conflicts');
      expect(diagnostics.recommendations).toContain('Multiple TMDB integrations detected - consider consolidating to avoid conflicts');
    });
  });

  describe('Cache Management', () => {
    test('should clear integration caches', async () => {
      mockTmdbService.clearCache.mockResolvedValue();

      await integrationService.clearIntegrationCache();

      expect(mockTmdbService.clearCache).toHaveBeenCalled();
    });
  });

  describe('Service Management', () => {
    test('should indicate if integrations are enabled', () => {
      const enabled = integrationService.isEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    test('should stop services properly', () => {
      mockStremioService.stop.mockImplementation(() => {});

      integrationService.stop();

      expect(mockStremioService.stop).toHaveBeenCalled();
    });
  });
});