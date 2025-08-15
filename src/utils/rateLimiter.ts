import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { RateLimitInfo } from '../types';
import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = new Date();
      const entry = this.requests.get(key);

      if (!entry || now > entry.resetTime) {
        // New window or expired entry
        this.requests.set(key, {
          count: 1,
          resetTime: new Date(now.getTime() + config.rateLimit.windowMs),
        });
        this.setHeaders(res, {
          windowMs: config.rateLimit.windowMs,
          maxRequests: config.rateLimit.maxRequests,
          currentRequests: 1,
          resetTime: new Date(now.getTime() + config.rateLimit.windowMs),
        });
        next();
        return;
      }

      if (entry.count >= config.rateLimit.maxRequests) {
        // Rate limit exceeded
        logger.warn({ ip: this.getClientIP(req), count: entry.count }, 'Rate limit exceeded');
        this.setHeaders(res, {
          windowMs: config.rateLimit.windowMs,
          maxRequests: config.rateLimit.maxRequests,
          currentRequests: entry.count,
          resetTime: entry.resetTime,
        });
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000),
        });
        return;
      }

      // Increment counter
      entry.count++;
      this.requests.set(key, entry);

      this.setHeaders(res, {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests,
        currentRequests: entry.count,
        resetTime: entry.resetTime,
      });

      next();
    };
  }

  private getKey(req: Request): string {
    // Use IP address as the key for rate limiting
    return this.getClientIP(req);
  }

  private getClientIP(req: Request): string {
    if (config.server.trustProxy) {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
    return req.connection.remoteAddress || 'unknown';
  }

  private setHeaders(res: Response, info: RateLimitInfo): void {
    res.set({
      'X-RateLimit-Limit': info.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, info.maxRequests - info.currentRequests).toString(),
      'X-RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
      'X-RateLimit-Window': Math.ceil(info.windowMs / 1000).toString(),
    });
  }

  private cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  getStats(): { totalKeys: number; activeRequests: number } {
    return {
      totalKeys: this.requests.size,
      activeRequests: Array.from(this.requests.values()).reduce(
        (sum, entry) => sum + entry.count,
        0
      ),
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

export const rateLimiter = new RateLimiter();
export default rateLimiter;
