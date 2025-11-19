import pino from 'pino';
import { BoundLogger, LoggingPort } from '../../domain/interfaces/logging';

/**
 * Pino-based implementation of LoggingPort.
 * Provides structured JSON logging with context binding.
 */
class PinoBoundLogger implements BoundLogger {
  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(context || {}, message);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(context || {}, message);
  }

  public error(
    message: string,
    error?: Error | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    const errorContext: Record<string, unknown> = { ...context };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined) {
      errorContext.error = error;
    }

    this.logger.error(errorContext, message);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(context || {}, message);
  }
}

/**
 * Pino adapter for structured logging.
 * Implements LoggingPort interface following Dependency Inversion Principle.
 */
class PinoAdapter implements LoggingPort {
  private readonly logger: pino.Logger;

  constructor(options?: pino.LoggerOptions) {
    // Default to pretty printing in development, JSON in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    this.logger = pino({
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      ...options,
    });
  }

  /**
   * Creates a bound logger with context.
   * All log messages from the returned logger will include the bound context.
   *
   * @param context - Context fields to bind to all log messages
   * @returns Bound logger with context
   */
  public bind(context: Record<string, unknown>): BoundLogger {
    const childLogger = this.logger.child(context);
    return new PinoBoundLogger(childLogger);
  }
}

export default PinoAdapter;
