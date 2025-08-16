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

    // Test manifest for validation
    this.app.get('/test/manifest.json', (req, res) => {
      const testManifest = {
        ...manifest,
        id: 'dev.mehdi.sukenyaa.test',
        name: 'SukeNyaa Test',
        description: 'Test version of SukeNyaa addon for validation',
        catalogs: [
          {
            type: 'anime',
            id: 'nyaa-anime-all',
            name: 'Test Anime Catalog',
            extra: [
              {
                name: 'search',
                isRequired: false,
              }
            ],
          }
        ]
      };
      res.json(testManifest);
    });

    // Test endpoint with dummy data for validation
    this.app.get('/test/catalog/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        
        // Return test data to validate Stremio integration
        const testMetas = [
          {
            id: 'nyaa:12345',
            type: type,
            name: 'Test Anime - Attack on Titan',
            poster: 'https://nyaa.si/static/img/avatar/default.png',
            description: 'Test description for Stremio addon validation',
            year: '2023',
            genres: ['Action', 'Adventure']
          },
          {
            id: 'nyaa:12346', 
            type: type,
            name: 'Test Anime - One Piece',
            poster: 'https://nyaa.si/static/img/avatar/default.png',
            description: 'Another test description',
            year: '2023',
            genres: ['Adventure', 'Comedy']
          }
        ];

        res.json({ metas: testMetas });
        logger.info({ type, id, count: testMetas.length }, 'Test catalog request completed');
      } catch (error) {
        logger.error({ error }, 'Test catalog request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/test/meta/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        
        const testMeta = {
          id: id,
          type: type,
          name: 'Test Anime - Attack on Titan',
          poster: 'https://nyaa.si/static/img/avatar/default.png',
          background: 'https://nyaa.si/static/img/logo.png', 
          description: 'Test anime description for Stremio validation. This is a dummy entry to test the addon functionality.',
          year: '2023',
          imdbRating: '8.5',
          genres: ['Action', 'Adventure', 'Drama'],
          director: ['Test Director'],
          cast: ['Test Actor 1', 'Test Actor 2'],
          runtime: '24 min',
          language: 'Japanese',
          country: 'Japan'
        };

        res.json({ meta: testMeta });
        logger.info({ type, id }, 'Test meta request completed');
      } catch (error) {
        logger.error({ error }, 'Test meta request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    this.app.get('/test/stream/:type/:id.json', async (req, res) => {
      try {
        const { type, id } = req.params;
        
        const testStreams = [
          {
            name: 'Test Stream 1080p',
            title: '🔴 Test Stream - Attack on Titan S1 [1080p]',
            url: 'magnet:?xt=urn:btih:test1234567890abcdef&dn=Test+Stream&tr=http://tracker.example.com:8080/announce',
            behaviorHints: {
              notWebReady: true
            }
          },
          {
            name: 'Test Stream 720p',
            title: '🟡 Test Stream - Attack on Titan S1 [720p]', 
            url: 'magnet:?xt=urn:btih:test0987654321fedcba&dn=Test+Stream+720p&tr=http://tracker.example.com:8080/announce',
            behaviorHints: {
              notWebReady: true
            }
          }
        ];

        res.json({ streams: testStreams });
        logger.info({ type, id, count: testStreams.length }, 'Test stream request completed');
      } catch (error) {
        logger.error({ error }, 'Test stream request failed');
        res.status(500).json({ error: 'Internal Server Error' });
      }
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
        testManifest: '/test/manifest.json',
        testPage: '/test',
        status: 'online',
        endpoints: {
          manifest: '/manifest.json',
          testManifest: '/test/manifest.json',
          testPage: '/test',
          testCatalog: '/test/catalog/anime/nyaa-anime-all.json',
          testMeta: '/test/meta/anime/nyaa:12345.json', 
          testStream: '/test/stream/anime/nyaa:12345.json',
          health: '/api/health',
          metrics: '/api/metrics',
          info: '/api/info',
        },
      });
    });

    // Test page for validation
    this.app.get('/test', (req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SukeNyaa Stremio Addon Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: white; }
        .container { max-width: 800px; margin: 0 auto; }
        .endpoint { margin: 20px 0; padding: 15px; background: #2a2a2a; border-radius: 5px; }
        .endpoint h3 { color: #4CAF50; margin: 0 0 10px 0; }
        .url { color: #FFB74D; font-family: monospace; word-break: break-all; }
        .test-btn { background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 5px 0; }
        .result { background: #333; padding: 10px; margin: 10px 0; border-radius: 3px; font-family: monospace; font-size: 12px; overflow-x: auto; }
        .success { border-left: 3px solid #4CAF50; }
        .error { border-left: 3px solid #f44336; }
        .install-link { background: #FF5722; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
        .install-link:hover { background: #E64A19; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 SukeNyaa Stremio Addon Test</h1>
        <p>Test page for validating SukeNyaa addon compatibility with Stremio Android.</p>
        
        <div class="endpoint">
            <h3>📋 Main Manifest (Installation URL)</h3>
            <div class="url">http://localhost:3000/manifest.json</div>
            <button class="test-btn" onclick="testEndpoint('/manifest.json', 'manifest-result')">Test Manifest</button>
            <div id="manifest-result" class="result"></div>
            <br>
            <strong>Installation URL for Stremio:</strong> <code>http://localhost:3000/manifest.json</code>
        </div>

        <div class="endpoint">
            <h3>🧪 Test Endpoints</h3>
            <button class="test-btn" onclick="testEndpoint('/test/catalog/anime/nyaa-anime-all.json', 'catalog-result')">Test Catalog</button>
            <button class="test-btn" onclick="testEndpoint('/test/meta/anime/nyaa:12345.json', 'meta-result')">Test Meta</button>
            <button class="test-btn" onclick="testEndpoint('/test/stream/anime/nyaa:12345.json', 'stream-result')">Test Stream</button>
            <div id="catalog-result" class="result"></div>
            <div id="meta-result" class="result"></div>
            <div id="stream-result" class="result"></div>
        </div>

        <h2>📱 Installation Instructions for Android/Termux</h2>
        <ol>
            <li>Start the SukeNyaa server on your Android device using Termux</li>
            <li>Make sure the server is running on <code>http://localhost:3000</code></li>
            <li>Open Stremio Android app</li>
            <li>Go to <strong>Add-ons</strong> → <strong>Community Add-ons</strong></li>
            <li>Enter the URL: <strong>http://localhost:3000/manifest.json</strong></li>
            <li>Click <strong>Install</strong></li>
            <li>The addon should appear in your installed addons list</li>
        </ol>

        <h2>✅ Compatibility Status</h2>
        <ul id="checklist">
            <li>✅ Server listens on localhost (127.0.0.1:3000)</li>
            <li>✅ CORS headers configured for cross-origin requests</li>
            <li>✅ Manifest endpoint returns valid JSON</li>
            <li>✅ Catalog, Meta, and Stream endpoints implemented</li>
            <li>✅ Test data available for validation</li>
            <li>✅ Compatible with Stremio addon SDK standards</li>
        </ul>
    </div>

    <script>
        async function testEndpoint(path, resultId) {
            const resultDiv = document.getElementById(resultId);
            resultDiv.innerHTML = '⏳ Testing...';
            resultDiv.className = 'result';
            
            try {
                const response = await fetch('http://localhost:3000' + path);
                const data = await response.json();
                
                resultDiv.innerHTML = \`✅ Status: \${response.status}<br><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
                resultDiv.className = 'result success';
            } catch (error) {
                resultDiv.innerHTML = \`❌ Error: \${error.message}\`;
                resultDiv.className = 'result error';
            }
        }

        // Auto-test manifest on page load
        window.onload = () => {
            testEndpoint('/manifest.json', 'manifest-result');
        };
    </script>
</body>
</html>`);
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