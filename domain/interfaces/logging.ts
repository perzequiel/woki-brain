/**
 * Logging port interface for domain/application layers.
 * Implementations should be in infrastructure layer.
 *
 * This interface allows structured logging with context binding,
 * following the Dependency Inversion Principle.
 */

/**
 * Bound logger with context already attached.
 * All log methods will include the bound context.
 */
export interface BoundLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Logging port interface.
 * Provides structured logging with context binding capabilities.
 */
export interface LoggingPort {
  /**
   * Creates a bound logger with context.
   * All log messages from the returned logger will include the bound context.
   *
   * @param context - Context fields to bind to all log messages
   * @returns Bound logger with context
   *
   * @example
   * const log = loggingPort.bind({ requestId: 'req-123', op: 'discover' });
   * log.info('operation_started'); // Will include requestId and op in output
   */
  bind(context: Record<string, unknown>): BoundLogger;
}
