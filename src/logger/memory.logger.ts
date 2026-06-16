import { ConsoleLogger, Injectable } from '@nestjs/common';

export const IN_MEMORY_LOGS: Array<{ timestamp: string; level: string; context: string; message: any }> = [];
const MAX_LOGS = 20;

@Injectable()
export class MemoryLogger extends ConsoleLogger {
  private addLog(level: string, message: any, context?: string) {
    IN_MEMORY_LOGS.unshift({
      timestamp: new Date().toISOString(),
      level,
      context: context || this.context || '',
      message,
    });
    
    if (IN_MEMORY_LOGS.length > MAX_LOGS) {
      IN_MEMORY_LOGS.pop();
    }
  }

  log(message: any, context?: string) {
    this.addLog('LOG', message, context);
    super.log(message, context);
  }

  error(message: any, stackOrContext?: string, context?: string) {
    this.addLog('ERROR', message, context || stackOrContext);
    super.error(message, stackOrContext, context);
  }

  warn(message: any, context?: string) {
    this.addLog('WARN', message, context);
    super.warn(message, context);
  }

  debug(message: any, context?: string) {
    this.addLog('DEBUG', message, context);
    super.debug(message, context);
  }

  verbose(message: any, context?: string) {
    this.addLog('VERBOSE', message, context);
    super.verbose(message, context);
  }
}
