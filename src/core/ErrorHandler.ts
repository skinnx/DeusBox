import { eventBus } from '@/core/EventBus.js';

interface ErrorRecord {
  timestamp: number;
  message: string;
  stack?: string;
  context?: string;
  recovered: boolean;
}

const MAX_ERROR_LOG = 50;
const ERROR_STORAGE_KEY = 'deusbox_errors';

class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private errors: ErrorRecord[] = [];
  private initialized = false;
  private onCriticalError: (() => void) | null = null;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  init(onCritical?: () => void): void {
    if (this.initialized) return;
    this.initialized = true;
    this.onCriticalError = onCritical ?? null;

    window.addEventListener('error', (event) => {
      this.handleError(event.error ?? new Error(event.message), 'window.onerror');
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      this.handleError(error, 'unhandledrejection');
      event.preventDefault();
    });

    const savedErrors = this.loadErrors();
    if (savedErrors.length > 0) {
      const lastError = savedErrors[savedErrors.length - 1];
      if (lastError && Date.now() - lastError.timestamp < 5000) {
        console.warn('[ErrorHandler] Detected recent crash. Recovery mode active.');
      }
    }
  }

  handleError(error: Error, context?: string): void {
    const record: ErrorRecord = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context: context ?? 'unknown',
      recovered: true,
    };

    this.errors.push(record);
    if (this.errors.length > MAX_ERROR_LOG) {
      this.errors.shift();
    }

    console.error(`[DeusBox Error] [${context}]`, error.message);
    this.saveErrors();

    if (this.isCritical(error)) {
      record.recovered = false;
      this.saveErrors();
      if (this.onCriticalError) {
        this.onCriticalError();
      }
    }
  }

  wrapScene<T extends (...args: unknown[]) => unknown>(fn: T, context: string): T {
    return ((...args: unknown[]) => {
      try {
        return fn(...args);
      } catch (err) {
        this.handleError(err instanceof Error ? err : new Error(String(err)), context);
        return undefined;
      }
    }) as T;
  }

  getErrors(): ReadonlyArray<ErrorRecord> {
    return this.errors;
  }

  getLastError(): ErrorRecord | null {
    return this.errors.length > 0 ? this.errors[this.errors.length - 1]! : null;
  }

  clearErrors(): void {
    this.errors = [];
    this.saveErrors();
  }

  private isCritical(error: Error): boolean {
    const criticalPatterns = [
      'out of memory',
      'maximum call stack',
      'webgl context lost',
      'cannot read properties of null',
    ];
    const msg = error.message.toLowerCase();
    return criticalPatterns.some(p => msg.includes(p));
  }

  private saveErrors(): void {
    try {
      const slim = this.errors.slice(-10).map(e => ({
        t: e.timestamp,
        m: e.message.substring(0, 200),
        c: e.context,
        r: e.recovered,
      }));
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // ignore
    }
  }

  private loadErrors(): ErrorRecord[] {
    try {
      const raw = localStorage.getItem(ERROR_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ t: number; m: string; c: string; r: boolean }>;
      return parsed.map(e => ({
        timestamp: e.t,
        message: e.m,
        context: e.c,
        recovered: e.r,
      }));
    } catch {
      return [];
    }
  }
}

export const errorHandler = ErrorHandler.getInstance();
export { ErrorHandler };
