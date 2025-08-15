import { HealthStatus } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metricsService } from './metrics';
import { cacheService } from './cache';
import NyaaScraper from './nyaaScraper';

class HealthService {
  private nyaaScraper: NyaaScraper;
  private sukebeiScraper: NyaaScraper;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthStatus: HealthStatus;

  constructor() {
    this.nyaaScraper = new NyaaScraper(config.externalServices.nyaaBaseUrl);
    this.sukebeiScraper = new NyaaScraper(config.externalServices.sukebeiBaseUrl);

    this.lastHealthStatus = {
      status: 'unknown' as any,
      timestamp: new Date().toISOString(),
      services: {
        nyaa: 'unknown',
        sukebei: 'unknown',
      },
      metrics: {
        requestCount: 0,
        errorRate: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
      },
    };

    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    if (config.monitoring.enableMetrics) {
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          logger.error({ error }, 'Health check failed');
        }
      }, config.monitoring.healthCheckIntervalMs);
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const metrics = metricsService.getMetrics();

    // Check external services
    const [nyaaHealth, sukebeiHealth] = await Promise.allSettled([
      this.checkServiceHealth(this.nyaaScraper, 'nyaa'),
      this.checkServiceHealth(this.sukebeiScraper, 'sukebei'),
    ]);

    const services = {
      nyaa: nyaaHealth.status === 'fulfilled' && nyaaHealth.value ? 'up' : 'down',
      sukebei: sukebeiHealth.status === 'fulfilled' && sukebeiHealth.value ? 'up' : 'down',
      redis: await this.checkRedisHealth(),
    } as const;

    // Calculate overall status
    const servicesDown = Object.values(services).filter((status) => status === 'down').length;
    const status = servicesDown === 0 ? 'healthy' : servicesDown === 1 ? 'degraded' : 'unhealthy';

    this.lastHealthStatus = {
      status,
      timestamp,
      services,
      metrics: {
        requestCount: metrics.requestCount,
        errorRate: metricsService.getErrorRate(),
        averageResponseTime: metrics.averageResponseTime,
        cacheHitRate: metrics.cacheHitRate,
      },
    };

    // Log health status if it changed
    if (status !== 'healthy') {
      logger.warn({ health: this.lastHealthStatus }, 'Service health degraded');
    }

    return this.lastHealthStatus;
  }

  private async checkServiceHealth(scraper: NyaaScraper, serviceName: string): Promise<boolean> {
    try {
      const isHealthy = await scraper.checkHealth();
      logger.debug({ service: serviceName, healthy: isHealthy }, 'Service health check');
      return isHealthy;
    } catch (error) {
      logger.warn({ service: serviceName, error }, 'Service health check failed');
      return false;
    }
  }

  private async checkRedisHealth(): Promise<'up' | 'down' | 'unknown'> {
    try {
      const stats = cacheService.getStats();
      return stats.redis ? 'up' : 'unknown';
    } catch {
      return 'down';
    }
  }

  async getDetailedMetrics(): Promise<{
    health: HealthStatus;
    cache: any;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  }> {
    return {
      health: await this.getHealthStatus(),
      cache: cacheService.getStats(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  isHealthy(): boolean {
    return this.lastHealthStatus.status === 'healthy';
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const healthService = new HealthService();
export default healthService;
