import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentLogs() {
    return this.prisma.receipts.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        url_sefaz: true,
        updatedAt: true,
        userId: true,
      },
    });
  }

  async reprocessDeadLetters(): Promise<{ count: number }> {
    const ufTarget = process.env.UF_TARGET || 'go';
    const queueName = `nfe:queue:${ufTarget}`;
    const failedQueueName = `nfe:failed:${ufTarget}`;

    const redis = new Redis({
      host: process.env.UPSTASH_REDIS_HOST,
      port: Number(process.env.UPSTASH_REDIS_PORT || 6379),
      username: process.env.UPSTASH_REDIS_USERNAME,
      password: process.env.UPSTASH_REDIS_PASSWORD,
      tls: {},
    });

    try {
      let reprocessedCount = 0;

      while (true) {
        const item = await redis.rpop(failedQueueName);
        if (!item) break;

        const job = JSON.parse(item);
        const retryJob = { ...job, attempt: 1 };
        delete retryJob.failedAt;
        delete retryJob.error;

        await redis.lpush(queueName, JSON.stringify(retryJob));
        reprocessedCount++;
      }
      return { count: reprocessedCount };
    } finally {
      await redis.quit();
    }
  }
}
