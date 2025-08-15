import { Router, Request, Response } from 'express';
import { healthService } from '../services/health';
import { metricsService } from '../services/metrics';
import { cacheService } from '../services/cache';
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
    endpoints: {
      manifest: '/manifest.json',
      health: '/health',
      metrics: '/metrics',
      cache: {
        stats: '/cache/stats',
        clear: '/cache/clear (POST)',
      },
    },
    documentation: 'https://github.com/MehdiDlaPgl/sukenyaa',
  });
});

export default router;
