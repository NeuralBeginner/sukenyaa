import { logger } from '../utils/logger';
import { cacheService } from './cache';

interface RateLimitStatus {
  isLimited: boolean;
  resetTime: number;
  remainingRequests: number;
  delayMs: number;
}

interface RequestBatch {
  requests: Array<() => Promise<any>>;
  resolvers: Array<(value: any) => void>;
  rejectors: Array<(error: any) => void>;
}

export class RateLimitManager {
  private requestQueue: Array<{
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  
  private isProcessing = false;
  private lastRequestTime = 0;
  private rateLimitUntil = 0;
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes window
  private readonly maxRequestsPerWindow = 100; // Conservative limit
  private readonly baseDelayMs = 1000;
  private readonly rateLimitDelayMs = 5 * 60 * 1000; // 5 minutes when rate limited
  
  constructor() {
    // Start processing queue
    this.processQueue();
  }

  async executeRequest<T>(requestFn: () => Promise<T>, cacheKey?: string): Promise<T> {
    // Check cache first if cacheKey provided
    if (cacheKey) {
      const cached = await cacheService.get<T>(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'Request served from cache, skipping rate limit');
        return cached;
      }
    }

    // Check if we're currently rate limited
    const status = this.getRateLimitStatus();
    if (status.isLimited) {
      const message = `Rate limited by nyaa.si. Please wait ${Math.ceil(status.delayMs / 1000)} seconds before trying again.`;
      logger.warn({ 
        delayMs: status.delayMs, 
        resetTime: new Date(status.resetTime),
        userMessage: message 
      }, 'Request blocked due to rate limit');
      
      throw new Error(message);
    }

    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({
        request: requestFn,
        resolve,
        reject,
        timestamp: Date.now(),
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      if (!item) break;

      try {
        // Check if request is too old (5 minutes) and skip it
        if (Date.now() - item.timestamp > 5 * 60 * 1000) {
          item.reject(new Error('Request timed out in queue'));
          continue;
        }

        // Wait for rate limit if needed
        await this.waitForRateLimit();

        // Execute request
        const result = await item.request();
        this.recordSuccessfulRequest();
        item.resolve(result);

      } catch (error) {
        this.handleRequestError(error);
        item.reject(error);
      }
    }

    this.isProcessing = false;
    
    // If more requests came in while processing, restart
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Check if we're in a rate limit period
    if (now < this.rateLimitUntil) {
      const delay = this.rateLimitUntil - now;
      logger.info({ delayMs: delay }, 'Waiting for rate limit period to end');
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Normal throttling
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.baseDelayMs) {
      const delay = this.baseDelayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private recordSuccessfulRequest(): void {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.windowStart > this.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }
    
    this.requestCount++;
  }

  private handleRequestError(error: any): void {
    const errorMessage = error?.message || '';
    const statusCode = error?.response?.status;

    // Detect various rate limit indicators
    if (
      statusCode === 429 ||
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.toLowerCase().includes('too many requests') ||
      errorMessage.toLowerCase().includes('slow down') ||
      // Common nyaa.si patterns
      errorMessage.toLowerCase().includes('please wait') ||
      errorMessage.toLowerCase().includes('try again later')
    ) {
      this.rateLimitUntil = Date.now() + this.rateLimitDelayMs;
      
      logger.warn({
        error: errorMessage,
        statusCode,
        rateLimitUntil: new Date(this.rateLimitUntil),
        delayMinutes: this.rateLimitDelayMs / 60000,
      }, 'Rate limit detected, implementing cooldown period');
    }

    // Detect network issues that might indicate overloading
    if (
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('socket hang up')
    ) {
      // Implement progressive backoff for network issues
      const backoffDelay = Math.min(this.baseDelayMs * 2, 10000);
      this.rateLimitUntil = Date.now() + backoffDelay;
      
      logger.warn({
        error: errorMessage,
        backoffDelay,
      }, 'Network issue detected, implementing backoff');
    }
  }

  getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();
    const isLimited = now < this.rateLimitUntil;
    
    // Reset request count if window expired
    if (now - this.windowStart > this.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Check if we're approaching the request limit
    const approachingLimit = this.requestCount >= this.maxRequestsPerWindow * 0.8;
    
    return {
      isLimited: isLimited || approachingLimit,
      resetTime: this.rateLimitUntil,
      remainingRequests: Math.max(0, this.maxRequestsPerWindow - this.requestCount),
      delayMs: isLimited ? this.rateLimitUntil - now : 0,
    };
  }

  async clearRateLimit(): Promise<void> {
    this.rateLimitUntil = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
    logger.info('Rate limit manually cleared');
  }

  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const rateLimitManager = new RateLimitManager();
export default rateLimitManager;