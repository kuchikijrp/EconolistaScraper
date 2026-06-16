import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import Redis from 'ioredis';

import {
  NfeQueueJob,
  NfeQueueJobFailed,
} from './interfaces/nfe-queue-job.interface';
import { parseQueueJob } from './utils/parse-queue-job';
import {
  getErrorMessage,
  getErrorStack,
  getFailedQueueName,
  maskRedisHost,
} from './utils/worker-log.util';
import { ScraperService } from './scraper.service';

@Injectable()
export class ScraperWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScraperWorkerService.name);

  private readonly redis: Redis;

  private readonly ufTarget = process.env.UF_TARGET || 'go';

  private readonly appVersion = process.env.APP_VERSION ?? '0.0.1';

  private readonly nodeEnv = process.env.NODE_ENV ?? 'development';

  private isRunning = true;

  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly scraperService: ScraperService) {
    this.redis = this.createRedisClient();

    this.registerRedisEvents();
  }

  onModuleInit() {
    const queues = this.getQueues();

    this.logger.log({
      message: '🚀 Worker inicializado',
      mode: 'BRPOP',
      appVersion: this.appVersion,
      nodeEnv: this.nodeEnv,
      ufTarget: this.ufTarget,
      maxAttempts: this.MAX_ATTEMPTS,
      queues,
      failedQueues: queues.map(getFailedQueueName),
      redis: {
        host: maskRedisHost(process.env.UPSTASH_REDIS_HOST),
        port: Number(process.env.UPSTASH_REDIS_PORT || 6379),
        tls: true,
      },
    });

    void this.startWorker();
  }

  async onModuleDestroy() {
    this.logger.warn({
      message: '🛑 Encerrando worker',
      ufTarget: this.ufTarget,
    });

    this.isRunning = false;

    await this.redis.quit();
  }

  private createRedisClient(): Redis {
    return new Redis({
      host: process.env.UPSTASH_REDIS_HOST,
      port: Number(process.env.UPSTASH_REDIS_PORT || 6379),
      username: process.env.UPSTASH_REDIS_USERNAME,
      password: process.env.UPSTASH_REDIS_PASSWORD,
      tls: {},
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        return Math.min(times * 1000, 10000);
      },
    });
  }

  private registerRedisEvents() {
    this.redis.on('connect', () => {
      this.logger.log({
        message: '✅ Redis conectado',
        host: maskRedisHost(process.env.UPSTASH_REDIS_HOST),
      });
    });

    this.redis.on('ready', () => {
      this.logger.log({
        message: '🚀 Redis pronto',
        queues: this.getQueues(),
      });
    });

    this.redis.on('reconnecting', () => {
      this.logger.warn('🔄 Redis reconectando...');
    });

    this.redis.on('close', () => {
      this.logger.warn('⚠️ Redis conexão fechada');
    });

    this.redis.on('error', (error) => {
      this.logger.error({
        message: '❌ Redis error',
        host: maskRedisHost(process.env.UPSTASH_REDIS_HOST),
        error: getErrorMessage(error),
      });
    });
  }

  private getQueues(): string[] {
    return [`nfe:queue:${this.ufTarget}`];
  }

  private async startWorker() {
    while (this.isRunning) {
      let queueName = '';
      let job: NfeQueueJob | null = null;

      try {
        const result = await this.redis.brpop(...this.getQueues(), 0);

        if (!result) {
          continue;
        }

        [queueName] = result;

        const [, payload] = result;

        job = parseQueueJob(payload);

        if (!job) {
          this.logger.error({
            message: '❌ Payload inválido na fila',
            queue: queueName,
            payloadPreview: payload.slice(0, 200),
          });

          continue;
        }

        const startedAt = Date.now();

        this.logger.log({
          message: '🚀 Processando nota fiscal',
          queue: queueName,
          receiptId: job.receiptId,
          userId: job.userId,
          attempt: job.attempt,
          maxAttempts: this.MAX_ATTEMPTS,
        });

        const scraped = await this.scraperService.processUrl(
          job.url,
          job.receiptId,
          job.userId,
        );

        const saveResult = await this.scraperService.saveScrapedData(
          scraped,
          job.userId,
          job.receiptId,
        );

        this.logger.log({
          message: '✅ Nota processada',
          queue: queueName,
          receiptId: job.receiptId,
          userId: job.userId,
          attempt: job.attempt,
          pointsEarned: saveResult.pointsEarned,
          pointsBreakdown: saveResult.pointsBreakdown,
          pointsRecency: saveResult.pointsRecency,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        this.logger.error({
          message: '❌ Erro ao processar fila',
          queue: queueName || this.getQueues()[0],
          receiptId: job?.receiptId,
          userId: job?.userId,
          attempt: job?.attempt,
          error: errorMessage,
          stack: getErrorStack(error),
        });

        if (!job || !queueName) {
          await this.sleep(5000);
          continue;
        }

        const nextAttempt = job.attempt + 1;

        if (nextAttempt <= this.MAX_ATTEMPTS && this.isRetryableError(error)) {
          const retryJob: NfeQueueJob = {
            ...job,
            attempt: nextAttempt,
          };

          this.logger.warn({
            message: '🔄 Reenfileirando nota',
            queue: queueName,
            receiptId: job.receiptId,
            userId: job.userId,
            attempt: nextAttempt,
            maxAttempts: this.MAX_ATTEMPTS,
            error: errorMessage,
          });

          await this.redis.lpush(queueName, JSON.stringify(retryJob));
        } else {
          const failedQueue = getFailedQueueName(queueName);

          const failedJob: NfeQueueJobFailed = {
            ...job,
            attempt: nextAttempt,
            failedAt: new Date().toISOString(),
            error: errorMessage,
          };

          await this.redis.lpush(failedQueue, JSON.stringify(failedJob));

          this.logger.error({
            message: '☠️ Nota movida para dead-letter queue',
            queue: failedQueue,
            sourceQueue: queueName,
            receiptId: job.receiptId,
            userId: job.userId,
            finalAttempt: nextAttempt,
            maxAttempts: this.MAX_ATTEMPTS,
            error: errorMessage,
          });
        }

        await this.sleep(5000);
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();

    const retryableErrors = [
      'timeout',
      'econnreset',
      'navigation',
      '503',
      'socket',
      'connection',
      'net::err',
      'redis',
      'protocol',
      'session closed',
    ];

    return retryableErrors.some((item) => message.includes(item));
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
