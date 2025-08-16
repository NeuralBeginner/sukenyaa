import { Router, Request, Response } from 'express';
import { healthService } from '../services/health';
import { metricsService } from '../services/metrics';
import { cacheService } from '../services/cache';
import { integrationService } from '../services/integrationService';
import { tmdbIntegrationService } from '../services/tmdbIntegration';
import { stremioIntegrationService } from '../services/stremioIntegration';
import { rateLimitManager } from '../services/rateLimitManager';
import { serverActivityMonitor } from '../services/serverActivityMonitor';
import { logger } from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await healthService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed metrics endpoint
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const detailed = await healthService.getDetailedMetrics();
    res.json(detailed);
  } catch (error) {
    logger.error({ error }, 'Failed to get metrics');
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// Simple metrics for monitoring tools
router.get('/metrics/prometheus', (req: Request, res: Response) => {
  try {
    const metrics = metricsService.getMetrics();
    const prometheusFormat = [
      '# HELP http_requests_total Total number of HTTP requests',
      '# TYPE http_requests_total counter',
      `http_requests_total ${metrics.requestCount}`,
      '',
      '# HELP http_request_duration_ms Average HTTP request duration in milliseconds',
      '# TYPE http_request_duration_ms gauge',
      `http_request_duration_ms ${metrics.averageResponseTime}`,
      '',
      '# HELP cache_hit_rate Cache hit rate',
      '# TYPE cache_hit_rate gauge',
      `cache_hit_rate ${metrics.cacheHitRate}`,
      '',
      '# HELP error_rate HTTP error rate',
      '# TYPE error_rate gauge',
      `error_rate ${metricsService.getErrorRate()}`,
      '',
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusFormat);
  } catch (error) {
    logger.error({ error }, 'Failed to generate Prometheus metrics');
    res.status(500).send('# Error generating metrics');
  }
});

// Cache management endpoints
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    await cacheService.clear();
    logger.info('Cache cleared manually');
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to clear cache');
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

router.get('/cache/stats', (req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats');
    res.status(500).json({ error: 'Failed to retrieve cache stats' });
  }
});

// API info endpoint
router.get('/info', (req: Request, res: Response) => {
  res.json({
    name: 'SukeNyaa',
    version: '1.0.0',
    description: 'Unofficial Stremio addon for nyaa.si and sukebei.nyaa.si content',
    features: {
      tmdbIntegration: 'Automatic metadata enhancement with TMDB',
      stremioExtensionDetection: 'Cross-extension compatibility and syncing',
      intelligentCaching: 'Smart caching with metadata priority',
      plugAndPlay: 'Zero-configuration automatic setup',
    },
    endpoints: {
      manifest: '/manifest.json',
      configure: '/configure',
      health: '/health',
      metrics: '/metrics',
      mobileHealth: '/mobile-health',
      networkTest: '/network-test',
      integrations: '/integrations',
      tmdbStatus: '/integrations/tmdb/status',
      extensionScan: '/integrations/extensions/scan',
      rateLimitStatus: '/rate-limit/status',
      activityStatus: '/activity/status',
      activityReport: '/activity/report',
      cache: {
        stats: '/cache/stats',
        clear: '/cache/clear (POST)',
        clearIntegrations: '/integrations/cache/clear (POST)',
      },
      rateLimit: {
        status: '/rate-limit/status',
        clear: '/rate-limit/clear (POST)',
      },
      activity: {
        status: '/activity/status',
        report: '/activity/report',
      },
    },
    documentation: 'https://github.com/MehdiDlaPgl/sukenyaa',
  });
});

// Mobile-specific health endpoint
router.get('/mobile-health', async (req: Request, res: Response) => {
  try {
    const performanceReport = await healthService.getMobilePerformanceReport();
    res.json({
      timestamp: new Date().toISOString(),
      platform: {
        arch: process.arch,
        platform: process.platform,
        nodeVersion: process.version,
      },
      performance: performanceReport,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get mobile health metrics');
    res.status(500).json({ error: 'Failed to retrieve mobile health metrics' });
  }
});

// Network resilience test endpoint
router.get('/network-test', async (req: Request, res: Response) => {
  try {
    const networkTest = await healthService.performNetworkResilienceTest();
    res.json({
      timestamp: new Date().toISOString(),
      networkResilience: networkTest,
      recommendations: networkTest.success 
        ? ['Network connection is stable and reliable'] 
        : [
            'Network connection may be unstable',
            'Consider switching to WiFi if using mobile data',
            'Check your internet connection',
            'Try restarting the addon if issues persist'
          ]
    });
  } catch (error) {
    logger.error({ error }, 'Failed to perform network test');
    res.status(500).json({ error: 'Failed to perform network test' });
  }
});

// ================================
// INTEGRATION ENDPOINTS
// ================================

// Main integration status endpoint
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const status = await integrationService.getIntegrationStatus();
    const diagnostics = await integrationService.getDiagnostics();
    
    res.json({
      timestamp: new Date().toISOString(),
      enabled: integrationService.isEnabled(),
      status,
      summary: {
        tmdbAvailable: status.tmdb.available,
        extensionsDetected: status.extensions.detected,
        tmdbCompatibleExtensions: status.extensions.tmdbCompatible,
        conflictsDetected: status.extensions.conflicts.length,
      },
      recommendations: diagnostics.recommendations,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get integration status');
    res.status(500).json({ error: 'Failed to retrieve integration status' });
  }
});

// TMDB integration status
router.get('/integrations/tmdb/status', async (req: Request, res: Response) => {
  try {
    const tmdbStatus = await tmdbIntegrationService.getStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      tmdb: tmdbStatus,
      logs: {
        info: 'TMDB integration provides enhanced metadata including posters, descriptions, and ratings',
        configuration: {
          required: 'TMDB_API_KEY environment variable',
          optional: [
            'TMDB_ENABLED (default: true)',
            'TMDB_CACHE_TIMEOUT (default: 3600)',
            'TMDB_RATE_LIMIT_MS (default: 250)',
          ],
        },
        documentation: 'https://developers.themoviedb.org/3/getting-started/introduction',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get TMDB status');
    res.status(500).json({ error: 'Failed to retrieve TMDB status' });
  }
});

// Stremio extensions detection and status
router.get('/integrations/extensions', async (req: Request, res: Response) => {
  try {
    const extensions = stremioIntegrationService.getDetectedExtensions();
    const conflicts = stremioIntegrationService.getConflicts();
    const status = await stremioIntegrationService.getStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      extensions: extensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        description: ext.description,
        capabilities: ext.capabilities,
        baseUrl: ext.baseUrl,
        isActive: ext.isActive,
      })),
      status,
      conflicts,
      logs: {
        info: 'Automatic detection of other Stremio extensions for cross-referencing and metadata sharing',
        detectionPorts: [3000, 8080, 7000, 11470, 11471, 11472, 11473, 11474, 11475],
        configuration: {
          optional: [
            'STREMIO_INTEGRATION_ENABLED (default: true)',
            'STREMIO_DETECTION_INTERVAL (default: 300000ms)',
            'STREMIO_CROSS_REFERENCE (default: true)',
            'STREMIO_KNOWN_EXTENSIONS (comma-separated URLs)',
          ],
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get extensions status');
    res.status(500).json({ error: 'Failed to retrieve extensions status' });
  }
});

// Force refresh extensions scan
router.post('/integrations/extensions/scan', async (req: Request, res: Response) => {
  try {
    logger.info({ 
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'Manual extension scan requested');
    
    await stremioIntegrationService.refreshExtensions();
    const extensions = stremioIntegrationService.getDetectedExtensions();
    
    res.json({
      timestamp: new Date().toISOString(),
      message: 'Extension scan completed',
      detected: extensions.length,
      extensions: extensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        capabilities: ext.capabilities,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to scan for extensions');
    res.status(500).json({ error: 'Failed to scan for extensions' });
  }
});

// Force refresh all integrations
router.post('/integrations/refresh', async (req: Request, res: Response) => {
  try {
    logger.info({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'Manual integration refresh requested');
    
    await integrationService.refreshIntegrations();
    const status = await integrationService.getIntegrationStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      message: 'All integrations refreshed successfully',
      status,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to refresh integrations');
    res.status(500).json({ error: 'Failed to refresh integrations' });
  }
});

// Integration diagnostics endpoint
router.get('/integrations/diagnostics', async (req: Request, res: Response) => {
  try {
    const diagnostics = await integrationService.getDiagnostics();
    
    res.json({
      timestamp: new Date().toISOString(),
      diagnostics,
      logs: {
        info: 'Comprehensive diagnostics for troubleshooting integration issues',
        troubleshooting: {
          tmdbNotWorking: [
            'Check TMDB_API_KEY environment variable',
            'Verify API key is valid at https://developers.themoviedb.org/',
            'Check network connectivity',
            'Review logs for specific error messages',
          ],
          noExtensionsDetected: [
            'Ensure other Stremio extensions are running',
            'Check if extensions are running on standard ports',
            'Add extension URLs to STREMIO_KNOWN_EXTENSIONS',
            'Verify extensions have valid manifest.json endpoints',
          ],
          conflictsDetected: [
            'Review detected conflicts in the conflicts array',
            'Consider disabling duplicate functionality',
            'Adjust extension priorities if available',
            'Check logs for specific conflict details',
          ],
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get integration diagnostics');
    res.status(500).json({ error: 'Failed to retrieve integration diagnostics' });
  }
});

// Clear integration-specific cache
router.post('/integrations/cache/clear', async (req: Request, res: Response) => {
  try {
    logger.info({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'Integration cache clear requested');
    
    await integrationService.clearIntegrationCache();
    
    res.json({
      timestamp: new Date().toISOString(),
      message: 'Integration cache cleared successfully',
      note: 'TMDB metadata and extension cross-references have been cleared',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to clear integration cache');
    res.status(500).json({ error: 'Failed to clear integration cache' });
  }
});

// Rate limit status and management
router.get('/rate-limit/status', (req: Request, res: Response) => {
  try {
    const status = rateLimitManager.getRateLimitStatus();
    const queueStatus = rateLimitManager.getQueueStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      rateLimit: status,
      queue: queueStatus,
      userMessage: status.isLimited 
        ? `Rate limited. Please wait ${Math.ceil(status.delayMs / 1000)} seconds before trying again.`
        : 'No rate limit restrictions currently active',
      recommendations: status.isLimited 
        ? [
            'Wait for the rate limit to reset',
            'Try using search filters to reduce the number of requests',
            'Enable caching to reduce repeated requests',
            'Check your network connection stability'
          ]
        : [
            'Search functionality is operating normally',
            'Cache is helping reduce request frequency',
            'Rate limiting is protecting against overuse'
          ]
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get rate limit status');
    res.status(500).json({ error: 'Failed to retrieve rate limit status' });
  }
});

// Clear rate limit manually (for debugging)
router.post('/rate-limit/clear', async (req: Request, res: Response) => {
  try {
    logger.info({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }, 'Manual rate limit clear requested');
    
    await rateLimitManager.clearRateLimit();
    
    res.json({
      timestamp: new Date().toISOString(),
      message: 'Rate limit manually cleared',
      warning: 'Use this feature responsibly to avoid overwhelming nyaa.si servers',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to clear rate limit');
    res.status(500).json({ error: 'Failed to clear rate limit' });
  }
});

// Server activity monitoring for Android/Termux
router.get('/activity/status', (req: Request, res: Response) => {
  try {
    // Record this API request as activity
    serverActivityMonitor.recordActivity('request');
    
    const status = serverActivityMonitor.getActivityStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      activity: status,
      userMessage: status.termuxInBackground 
        ? '⚠️ Server may be paused due to Termux being in background. Keep Termux app open for best performance.'
        : status.isActive 
          ? '✅ Server is active and responding normally'
          : '⚠️ Server appears inactive - check network connectivity',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get activity status');
    res.status(500).json({ error: 'Failed to retrieve activity status' });
  }
});

// Detailed activity report for troubleshooting
router.get('/activity/report', async (req: Request, res: Response) => {
  try {
    // Record this API request as activity
    serverActivityMonitor.recordActivity('request');
    
    const report = await serverActivityMonitor.generateActivityReport();
    
    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Failed to generate activity report');
    res.status(500).json({ error: 'Failed to generate activity report' });
  }
});

export default router;
