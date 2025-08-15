import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface Metrics {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  endpoints: Record<
    string,
    {
      count: number;
      errors: number;
      totalTime: number;
      averageTime: number;
    }
  >;
}

class MetricsService {
  private metrics: Metrics = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    endpoints: {},
  };

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      // Initialize endpoint metrics if not exists
      if (!this.metrics.endpoints[endpoint]) {
        this.metrics.endpoints[endpoint] = {
          count: 0,
          errors: 0,
          totalTime: 0,
          averageTime: 0,
        };
      }

      const originalSend = res.send.bind(res);
      res.send = (body: any) => {
        const responseTime = Date.now() - startTime;

        // Update global metrics
        this.metrics.requestCount++;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.averageResponseTime =
          this.metrics.totalResponseTime / this.metrics.requestCount;

        // Update endpoint metrics
        const endpointMetrics = this.metrics.endpoints[endpoint]!;
        endpointMetrics.count++;
        endpointMetrics.totalTime += responseTime;
        endpointMetrics.averageTime = endpointMetrics.totalTime / endpointMetrics.count;

        // Track errors
        if (res.statusCode >= 400) {
          this.metrics.errorCount++;
          endpointMetrics.errors++;
        }

        // Log request
        logger.info(
          {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
          },
          'HTTP Request'
        );

        return originalSend(body);
      };

      next();
    };
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
    this.updateCacheHitRate();
  }

  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
  }

  getMetrics(): Metrics {
    return {
      ...this.metrics,
      endpoints: { ...this.metrics.endpoints },
    };
  }

  getErrorRate(): number {
    return this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0;
  }

  reset(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      endpoints: {},
    };
  }
}

export const metricsService = new MetricsService();
export default metricsService;
