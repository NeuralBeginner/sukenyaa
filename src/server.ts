import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { manifest } from './config/manifest';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rateLimiter';
import { metricsService } from './services/metrics';
import { healthService } from './services/health';
import { cacheService } from './services/cache';
import { addonService } from './services/addon';
import apiRoutes from './routes/api';

class Server {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disabled for Stremio compatibility
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: config.server.corsOrigin === '*' ? true : config.server.corsOrigin,
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Type'],
      optionsSuccessStatus: 200 // For legacy browser support
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy if configured
    if (config.server.trustProxy) {
      this.app.set('trust proxy', true);
    }

    // Rate limiting
    this.app.use(rateLimiter.middleware());

    // Metrics collection
    if (config.monitoring.enableMetrics) {
      this.app.use(metricsService.middleware());
    }

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      }, 'Incoming request');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check route (before rate limiting for monitoring)
    this.app.get('/ping', (req, res) => {
      res.status(200).send('pong');
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // Stremio addon routes - manually add manifest endpoint
    this.app.get('/manifest.json', (req, res) => {
      res.json(manifest);
    });

    // Mount Stremio addon SDK routes manually
    this.app.get('/catalog/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        const extra = req.query as Record<string, string>;
        const result = await addonService.getCatalog({ type, id, extra });
        res.json(result);
      } catch (error) {
        logger.error({ error, params: req.params, query: req.query }, 'Catalog request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/meta/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        const extra = req.query as Record<string, string>;
        const result = await addonService.getMeta({ type, id, extra });
        res.json(result);
      } catch (error) {
        logger.error({ error, params: req.params, query: req.query }, 'Meta request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/stream/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        const extra = req.query as Record<string, string>;
        const result = await addonService.getStream({ type, id, extra });
        res.json(result);
      } catch (error) {
        logger.error({ error, params: req.params, query: req.query }, 'Stream request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        name: config.addon.name,
        version: config.addon.version,
        description: config.addon.description,
        manifest: '/manifest.json',
        status: 'online',
        endpoints: {
          health: '/api/health',
          metrics: '/api/metrics',
          info: '/api/info',
        },
      });
    });

    // 404 handler for undefined routes
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          'GET /',
          'GET /manifest.json',
          'GET /catalog/:type/:id.json',
          'GET /meta/:type/:id.json', 
          'GET /stream/:type/:id.json',
          'GET /api/health',
          'GET /api/metrics',
          'GET /api/info',
        ],
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error({
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
      }, 'Unhandled error');

      res.status(500).json({
        error: 'Internal Server Error',
        message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong',
        ...(config.server.nodeEnv === 'development' && { stack: error.stack }),
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Listen on localhost (127.0.0.1) for local connections only
        this.server = this.app.listen(config.server.port, '127.0.0.1', () => {
          logger.info({
            port: config.server.port,
            host: '127.0.0.1',
            nodeEnv: config.server.nodeEnv,
            pid: process.pid,
          }, 'Server started successfully on localhost');
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error({ error }, 'Server startup error');
          reject(error);
        });
      } catch (error) {
        logger.error({ error }, 'Failed to start server');
        reject(error);
      }
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Graceful shutdown initiated');

    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Close external connections
      await cacheService.close();
      healthService.stopHealthChecks();
      rateLimiter.destroy();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export default Server;