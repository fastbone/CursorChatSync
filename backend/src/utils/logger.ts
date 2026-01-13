import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string;
  private errorLogFile: string;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as any) || LogLevel.INFO;
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorLogFile = path.join(this.logDir, 'error.log');

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, context?: Record<string, any>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
    };

    if (context) {
      logEntry.context = context;
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return JSON.stringify(logEntry);
  }

  private writeLog(level: LogLevel, levelName: string, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logMessage = this.formatMessage(levelName, message, context, error);
    const consoleMessage = `[${levelName}] ${message}${context ? ' ' + JSON.stringify(context) : ''}${error ? ' ' + error.message : ''}`;

    // Console output
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage);
        break;
      case LogLevel.INFO:
        console.log(consoleMessage);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage);
        break;
      case LogLevel.ERROR:
        console.error(consoleMessage);
        break;
    }

    // File output
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
      
      // Also write errors to error log
      if (level === LogLevel.ERROR) {
        fs.appendFileSync(this.errorLogFile, logMessage + '\n');
      }
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLog(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLog(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.writeLog(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.writeLog(LogLevel.ERROR, 'ERROR', message, context, error);
  }

  // Structured logging helpers
  logRequest(method: string, path: string, statusCode: number, duration: number, userId?: number): void {
    this.info('HTTP Request', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      userId,
    });
  }

  logAuth(action: string, userId?: number, success: boolean = true, reason?: string): void {
    this.info(`Auth ${action}`, {
      userId,
      success,
      reason,
    });
  }

  logSync(action: string, userId: number, projectId: number, success: boolean, error?: Error): void {
    if (success) {
      this.info(`Sync ${action}`, { userId, projectId });
    } else {
      this.error(`Sync ${action} failed`, error, { userId, projectId });
    }
  }

  logPermission(action: string, permissionId: number, userId: number, projectId: number): void {
    this.info(`Permission ${action}`, {
      permissionId,
      userId,
      projectId,
    });
  }
}

export const logger = new Logger();
