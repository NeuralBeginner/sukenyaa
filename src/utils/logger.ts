import pino from 'pino';
import { config } from '../config';

const isDevelopment = config.server.nodeEnv === 'development';

export const logger = pino({
  level: config.monitoring.logLevel,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export default logger;
