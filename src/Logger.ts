import pino, { Logger } from 'pino';

const env = (process.env.NODE_ENV || 'development').toLowerCase();
const isDev = env === 'development' || env === 'dev' || env === 'local';
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const devTransport = {
    target: 'pino-pretty',
    options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
    },
};

const logger: Logger = pino({
    level,
    base: {
        service: process.env.SERVICE_NAME || 'express-master-controller',
        env,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label: string) => ({ level: label }),
    },
    ...(isDev ? { transport: devTransport } : {}),
});

export const createLogger = (scope: string): Logger => logger.child({ scope });

export default logger;
