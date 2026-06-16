import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

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
}
