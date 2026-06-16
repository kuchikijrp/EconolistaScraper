import { ConsoleLogger, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class MemoryLogger extends ConsoleLogger {
  private redis: Redis;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.UPSTASH_REDIS_HOST,
      port: Number(process.env.UPSTASH_REDIS_PORT || 6379),
      username: process.env.UPSTASH_REDIS_USERNAME,
      password: process.env.UPSTASH_REDIS_PASSWORD,
      tls: {},
    });
  }

  private addLog(level: string, message: any, context?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || this.context || '',
      message,
    };

    // Salva no Redis (fire-and-forget) para que todas as instâncias da Vercel compartilhem
    this.redis.lpush('econolista:dashboard_logs', JSON.stringify(logEntry))
      .then(() => {
        this.redis.ltrim('econolista:dashboard_logs', 0, 49).catch(() => {});
      })
      .catch(() => {});
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
