// src/utils/logger.ts
type LogLevel = 'info' | 'error' | 'warn' | 'debug';

interface LogConfig {
  isDevelopment: boolean;
  isDebugMode: boolean;
  enableConsole: boolean;
}

class Logger {
  private config: LogConfig;

  constructor() {
    this.config = {
      isDevelopment: process.env.NODE_ENV === 'development',
      isDebugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
      enableConsole: process.env.NEXT_PUBLIC_ENABLE_CONSOLE === 'true'
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // 프로덕션에서는 error만 표시
    if (!this.config.isDevelopment && !this.config.isDebugMode) {
      return level === 'error';
    }
    
    // 개발환경에서는 모든 로그 표시 (enableConsole이 true인 경우)
    return this.config.enableConsole || this.config.isDevelopment;
  }

  private formatMessage(level: LogLevel, message: string, timestamp: string): string {
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}`;
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS 형태
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const timestamp = this.getCurrentTimestamp();
      const formattedMessage = this.formatMessage('info', message, timestamp);
      
      if (data !== undefined) {
        console.log(formattedMessage, data);
      } else {
        console.log(formattedMessage);
      }
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      const timestamp = this.getCurrentTimestamp();
      const formattedMessage = this.formatMessage('error', message, timestamp);
      
      if (error !== undefined) {
        console.error(formattedMessage, error);
      } else {
        console.error(formattedMessage);
      }
      
      // TODO: 프로덕션에서는 에러 로깅 서비스로 전송 (Sentry, LogRocket 등)
      // this.sendToErrorService(message, error);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const timestamp = this.getCurrentTimestamp();
      const formattedMessage = this.formatMessage('warn', message, timestamp);
      
      if (data !== undefined) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const timestamp = this.getCurrentTimestamp();
      const formattedMessage = this.formatMessage('debug', message, timestamp);
      
      if (data !== undefined) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
    }
  }

  // 카테고리별 전용 로거
  auth = {
    info: (message: string, data?: any) => this.info(`[AUTH] ${message}`, data),
    error: (message: string, error?: any) => this.error(`[AUTH] ${message}`, error),
    warn: (message: string, data?: any) => this.warn(`[AUTH] ${message}`, data)
  };

  schedule = {
    info: (message: string, data?: any) => this.info(`[SCHEDULE] ${message}`, data),
    error: (message: string, error?: any) => this.error(`[SCHEDULE] ${message}`, error),
    warn: (message: string, data?: any) => this.warn(`[SCHEDULE] ${message}`, data)
  };

  permission = {
    info: (message: string, data?: any) => this.info(`[PERMISSION] ${message}`, data),
    error: (message: string, error?: any) => this.error(`[PERMISSION] ${message}`, error),
    warn: (message: string, data?: any) => this.warn(`[PERMISSION] ${message}`, data)
  };

  api = {
    info: (message: string, data?: any) => this.info(`[API] ${message}`, data),
    error: (message: string, error?: any) => this.error(`[API] ${message}`, error),
    warn: (message: string, data?: any) => this.warn(`[API] ${message}`, data)
  };
}

// 싱글톤 인스턴스 생성
export const logger = new Logger();

// 개발용 헬퍼 함수들
export const devLog = {
  component: (name: string, action: string, data?: any) => {
    logger.debug(`[COMPONENT:${name}] ${action}`, data);
  },
  
  hook: (name: string, action: string, data?: any) => {
    logger.debug(`[HOOK:${name}] ${action}`, data);
  },
  
  effect: (componentName: string, dependencies: string[], action: string) => {
    logger.debug(`[EFFECT:${componentName}] ${action}`, { dependencies });
  }
};

export default logger;
