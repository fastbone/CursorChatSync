import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  private logFile: string | null = null;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.logLevel = LogLevel.INFO; // Can be configured via settings
    this.outputChannel = vscode.window.createOutputChannel('Cursor Chat Sync');
    
    // Set up log file
    try {
      const logDir = path.join(os.homedir(), '.cursor-chat-sync', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFileName = `extension-${new Date().toISOString().split('T')[0]}.log`;
      this.logFile = path.join(logDir, logFileName);
    } catch (error) {
      // Log file setup failed, continue with output channel only
      console.warn('Failed to set up log file:', error);
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

    // Output channel
    this.outputChannel.appendLine(consoleMessage);

    // File output
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logMessage + '\n');
      } catch (err) {
        // Silently fail if file write fails
      }
    }

    // Console output for errors
    if (level === LogLevel.ERROR) {
      console.error(consoleMessage);
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
  logSync(action: string, success: boolean, context?: Record<string, any>, error?: Error): void {
    if (success) {
      this.info(`Sync ${action}`, context);
    } else {
      this.error(`Sync ${action} failed`, error, context);
    }
  }

  logAuth(action: string, success: boolean, reason?: string): void {
    if (success) {
      this.info(`Auth ${action}`, { reason });
    } else {
      this.warn(`Auth ${action} failed`, { reason });
    }
  }

  showOutputChannel(): void {
    this.outputChannel.show();
  }
}

export const logger = new Logger();
