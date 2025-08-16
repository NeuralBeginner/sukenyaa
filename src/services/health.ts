import { HealthStatus } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metricsService } from './metrics';
import { cacheService } from './cache';
import { configurationService } from './config';
import NyaaScraper from './nyaaScraper';

interface MobileHealthMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  networkLatency: number;
  scraperResponseTime: number;
  configurationServiceHealth: boolean;
  cacheServiceHealth: boolean;
}

class HealthService {
  private nyaaScraper: NyaaScraper;
  private sukebeiScraper: NyaaScraper;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthStatus: HealthStatus;
  private mobileMetrics: MobileHealthMetrics | null = null;

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
    mobile?: MobileHealthMetrics;
  }> {
    const mobileMetrics = await this.getMobileHealthMetrics();
    
    return {
      health: await this.getHealthStatus(),
      cache: cacheService.getStats(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      mobile: mobileMetrics,
    };
  }

  async getMobileHealthMetrics(): Promise<MobileHealthMetrics> {
    const start = Date.now();
    
    // Test scraper response time
    let scraperResponseTime = 0;
    try {
      const scraperStart = Date.now();
      await this.nyaaScraper.checkHealth();
      scraperResponseTime = Date.now() - scraperStart;
    } catch {
      scraperResponseTime = -1; // Indicates failure
    }
    
    // Test configuration service
    let configurationServiceHealth = false;
    try {
      await configurationService.getUserConfiguration();
      configurationServiceHealth = true;
    } catch (error) {
      logger.warn({ error }, 'Configuration service health check failed');
    }
    
    // Test cache service
    let cacheServiceHealth = false;
    try {
      const stats = cacheService.getStats();
      cacheServiceHealth = !!stats;
    } catch (error) {
      logger.warn({ error }, 'Cache service health check failed');
    }
    
    // Calculate network latency (approximation)
    const networkLatency = Date.now() - start;
    
    this.mobileMetrics = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      networkLatency,
      scraperResponseTime,
      configurationServiceHealth,
      cacheServiceHealth,
    };
    
    return this.mobileMetrics;
  }

  async getMobilePerformanceReport(): Promise<{
    grade: 'excellent' | 'good' | 'poor' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: MobileHealthMetrics;
  }> {
    const metrics = await this.getMobileHealthMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Memory analysis
    const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 200) {
      issues.push('High memory usage detected');
      recommendations.push('Consider reducing cache size or restarting the service');
    } else if (memoryUsageMB > 100) {
      recommendations.push('Monitor memory usage - consider periodic restarts for long-running sessions');
    }
    
    // Response time analysis
    if (metrics.scraperResponseTime === -1) {
      issues.push('Scraper service is unresponsive');
      recommendations.push('Check network connectivity and nyaa.si availability');
    } else if (metrics.scraperResponseTime > 5000) {
      issues.push('Very slow scraper response times');
      recommendations.push('Check network connection quality');
    } else if (metrics.scraperResponseTime > 2000) {
      recommendations.push('Consider optimizing network settings for better performance');
    }
    
    // Service health analysis
    if (!metrics.configurationServiceHealth) {
      issues.push('Configuration service is not responding');
      recommendations.push('Restart the service if configuration features are needed');
    }
    
    if (!metrics.cacheServiceHealth) {
      issues.push('Cache service is not functioning properly');
      recommendations.push('Cache will fall back to in-memory only - consider Redis setup for production');
    }
    
    // Network latency analysis
    if (metrics.networkLatency > 1000) {
      issues.push('High network latency detected');
      recommendations.push('Check your internet connection and consider using WiFi instead of mobile data');
    }
    
    // Determine overall grade
    let grade: 'excellent' | 'good' | 'poor' | 'critical';
    if (issues.length === 0 && memoryUsageMB < 50 && metrics.scraperResponseTime < 1000) {
      grade = 'excellent';
    } else if (issues.length <= 1 && memoryUsageMB < 100 && metrics.scraperResponseTime < 2000) {
      grade = 'good';
    } else if (issues.length <= 2 && metrics.scraperResponseTime > 0) {
      grade = 'poor';
    } else {
      grade = 'critical';
    }
    
    return {
      grade,
      issues,
      recommendations,
      metrics,
    };
  }

  async performNetworkResilienceTest(): Promise<{
    success: boolean;
    results: Array<{ attempt: number; success: boolean; responseTime: number; error?: string }>;
    averageResponseTime: number;
    successRate: number;
  }> {
    const attempts = 3;
    const results = [];
    
    for (let i = 1; i <= attempts; i++) {
      const start = Date.now();
      try {
        await this.nyaaScraper.checkHealth();
        const responseTime = Date.now() - start;
        results.push({ attempt: i, success: true, responseTime });
      } catch (error: any) {
        const responseTime = Date.now() - start;
        results.push({ 
          attempt: i, 
          success: false, 
          responseTime, 
          error: error.message 
        });
      }
      
      // Add small delay between attempts
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successfulAttempts = results.filter(r => r.success);
    const successRate = (successfulAttempts.length / attempts) * 100;
    const averageResponseTime = successfulAttempts.length > 0 
      ? successfulAttempts.reduce((sum, r) => sum + r.responseTime, 0) / successfulAttempts.length
      : 0;
    
    return {
      success: successRate >= 66, // At least 2/3 must succeed
      results,
      averageResponseTime,
      successRate,
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
