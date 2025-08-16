import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import Server from '../../src/server';

describe('Integration API Endpoints', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use random port
    server = new Server();
    app = server.getApp();
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('GET /api/info', () => {
    test('should include integration features in API info', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);

      expect(response.body.features).toBeDefined();
      expect(response.body.features.tmdbIntegration).toBe('Automatic metadata enhancement with TMDB');
      expect(response.body.features.stremioExtensionDetection).toBe('Cross-extension compatibility and syncing');
      expect(response.body.features.intelligentCaching).toBe('Smart caching with metadata priority');
      expect(response.body.features.plugAndPlay).toBe('Zero-configuration automatic setup');

      expect(response.body.endpoints.integrations).toBe('/integrations');
      expect(response.body.endpoints.tmdbStatus).toBe('/integrations/tmdb/status');
      expect(response.body.endpoints.extensionScan).toBe('/integrations/extensions/scan');
    });
  });

  describe('GET /api/integrations', () => {
    test('should return integration status', async () => {
      const response = await request(app)
        .get('/api/integrations')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.enabled).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.status.tmdb).toBeDefined();
      expect(response.body.status.extensions).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(response.body.recommendations).toBeDefined();

      // Verify status structure
      expect(response.body.status.tmdb.available).toBeDefined();
      expect(response.body.status.tmdb.configured).toBeDefined();
      expect(response.body.status.extensions.detected).toBeDefined();
      expect(response.body.status.extensions.active).toBeDefined();
      expect(response.body.status.extensions.tmdbCompatible).toBeDefined();
      expect(response.body.status.extensions.conflicts).toBeDefined();
    });
  });

  describe('GET /api/integrations/tmdb/status', () => {
    test('should return TMDB specific status', async () => {
      const response = await request(app)
        .get('/api/integrations/tmdb/status')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.tmdb).toBeDefined();
      expect(response.body.logs).toBeDefined();

      // Verify TMDB status structure
      expect(response.body.tmdb.available).toBeDefined();
      expect(response.body.tmdb.configured).toBeDefined();
      expect(response.body.tmdb.initialized).toBeDefined();
      expect(response.body.tmdb.genreCount).toBeDefined();
      expect(response.body.tmdb.rateLimit).toBeDefined();
      expect(response.body.tmdb.rateLimit.remaining).toBeDefined();
      expect(response.body.tmdb.rateLimit.resetTime).toBeDefined();

      // Verify logs and documentation
      expect(response.body.logs.info).toBeDefined();
      expect(response.body.logs.configuration).toBeDefined();
      expect(response.body.logs.configuration.required).toBe('TMDB_API_KEY environment variable');
      expect(response.body.logs.documentation).toBe('https://developers.themoviedb.org/3/getting-started/introduction');
    });
  });

  describe('GET /api/integrations/extensions', () => {
    test('should return detected extensions', async () => {
      const response = await request(app)
        .get('/api/integrations/extensions')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.extensions).toBeDefined();
      expect(response.body.status).toBeDefined();
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.logs).toBeDefined();

      // Verify extensions is an array
      expect(Array.isArray(response.body.extensions)).toBe(true);

      // Verify status structure
      expect(response.body.status.detected).toBeDefined();
      expect(response.body.status.active).toBeDefined();
      expect(response.body.status.tmdbCompatible).toBeDefined();
      expect(response.body.status.lastScan).toBeDefined();

      // Verify logs and configuration info
      expect(response.body.logs.info).toBeDefined();
      expect(response.body.logs.detectionPorts).toBeDefined();
      expect(Array.isArray(response.body.logs.detectionPorts)).toBe(true);
      expect(response.body.logs.configuration).toBeDefined();
    });
  });

  describe('POST /api/integrations/extensions/scan', () => {
    test('should trigger extension scan', async () => {
      const response = await request(app)
        .post('/api/integrations/extensions/scan')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.message).toBe('Extension scan completed');
      expect(response.body.detected).toBeDefined();
      expect(response.body.extensions).toBeDefined();
      expect(Array.isArray(response.body.extensions)).toBe(true);
    });
  });

  describe('POST /api/integrations/refresh', () => {
    test('should refresh all integrations', async () => {
      const response = await request(app)
        .post('/api/integrations/refresh')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.message).toBe('All integrations refreshed successfully');
      expect(response.body.status).toBeDefined();
    });
  });

  describe('GET /api/integrations/diagnostics', () => {
    test('should return comprehensive diagnostics', async () => {
      const response = await request(app)
        .get('/api/integrations/diagnostics')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.diagnostics).toBeDefined();
      expect(response.body.logs).toBeDefined();

      // Verify diagnostics structure
      expect(response.body.diagnostics.config).toBeDefined();
      expect(response.body.diagnostics.status).toBeDefined();
      expect(response.body.diagnostics.detectedExtensions).toBeDefined();
      expect(response.body.diagnostics.conflicts).toBeDefined();
      expect(response.body.diagnostics.recommendations).toBeDefined();

      // Verify config structure
      expect(response.body.diagnostics.config.tmdb).toBeDefined();
      expect(response.body.diagnostics.config.stremioExtensions).toBeDefined();
      expect(response.body.diagnostics.config.fallback).toBeDefined();

      // Verify troubleshooting information
      expect(response.body.logs.info).toBeDefined();
      expect(response.body.logs.troubleshooting).toBeDefined();
      expect(response.body.logs.troubleshooting.tmdbNotWorking).toBeDefined();
      expect(response.body.logs.troubleshooting.noExtensionsDetected).toBeDefined();
      expect(response.body.logs.troubleshooting.conflictsDetected).toBeDefined();
    });
  });

  describe('POST /api/integrations/cache/clear', () => {
    test('should clear integration cache', async () => {
      const response = await request(app)
        .post('/api/integrations/cache/clear')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.message).toBe('Integration cache cleared successfully');
      expect(response.body.note).toBe('TMDB metadata and extension cross-references have been cleared');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid endpoint gracefully', async () => {
      await request(app)
        .get('/api/integrations/nonexistent')
        .expect(404);
    });

    test('should handle invalid methods gracefully', async () => {
      await request(app)
        .delete('/api/integrations')
        .expect(404);
    });
  });

  describe('Response Headers', () => {
    test('should return JSON content type for integration endpoints', async () => {
      const response = await request(app)
        .get('/api/integrations')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should include proper timestamp format', async () => {
      const response = await request(app)
        .get('/api/integrations')
        .expect(200);

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Configuration Validation', () => {
    test('should show TMDB as not configured when no API key is set', async () => {
      const response = await request(app)
        .get('/api/integrations/tmdb/status')
        .expect(200);

      // In test environment, TMDB should not be configured
      expect(response.body.tmdb.configured).toBe(false);
      expect(response.body.tmdb.available).toBe(false);
    });

    test('should provide configuration guidance', async () => {
      const response = await request(app)
        .get('/api/integrations/diagnostics')
        .expect(200);

      expect(response.body.diagnostics.recommendations).toContain('Configure TMDB API key for better metadata quality');
    });
  });
});