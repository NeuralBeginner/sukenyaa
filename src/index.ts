import { config } from './config';
import { logger } from './utils/logger';
import Server from './server';

async function main(): Promise<void> {
  try {
    logger.info({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: config.server.nodeEnv,
    }, 'Starting SukeNyaa addon');

    const server = new Server();
    await server.start();

    logger.info('SukeNyaa addon is ready to serve content!');
  } catch (error) {
    logger.fatal({ error }, 'Failed to start application');
    process.exit(1);
  }
}

// Handle uncaught errors at the module level
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('Application startup failed:', error);
  process.exit(1);
});