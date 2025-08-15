import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheEntry } from '../types';

class CacheService {
  private nodeCache: NodeCache;
  private redisClient: RedisClientType | null = null;
  private useRedis = false;

  constructor() {
    this.nodeCache = new NodeCache({
      stdTTL: config.cache.ttl,
      maxKeys: config.cache.maxSize,
      useClones: false,
    });

    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    if (!config.redis.url) {
      logger.info('Redis URL not provided, using in-memory cache only');
      return;
    }

    try {
      const clientOptions: any = {
        url: config.redis.url,
        database: config.redis.db,
      };

      if (config.redis.password) {
        clientOptions.password = config.redis.password;
      }

      this.redisClient = createClient(clientOptions);

      this.redisClient.on('error', (error) => {
        logger.error({ error }, 'Redis connection error');
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis');
        this.useRedis = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Redis');
      this.useRedis = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.redisClient) {
        const result = await this.redisClient.get(key);
        if (result) {
          const entry: CacheEntry<T> = JSON.parse(result);
          if (Date.now() - entry.timestamp < entry.ttl * 1000) {
            return entry.data;
          } else {
            await this.redisClient.del(key);
          }
        }
      }

      // Fallback to node cache
      return this.nodeCache.get<T>(key) || null;
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const actualTtl = ttl || config.cache.ttl;

    try {
      if (this.useRedis && this.redisClient) {
        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl: actualTtl,
        };
        await this.redisClient.setEx(key, actualTtl, JSON.stringify(entry));
      }

      // Always set in node cache as fallback
      this.nodeCache.set(key, value, actualTtl);
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(key);
      }
      this.nodeCache.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.flushDb();
      }
      this.nodeCache.flushAll();
    } catch (error) {
      logger.error({ error }, 'Cache clear error');
    }
  }

  getStats(): { nodeCache: NodeCache.Stats; redis: boolean } {
    return {
      nodeCache: this.nodeCache.getStats(),
      redis: this.useRedis,
    };
  }

  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;