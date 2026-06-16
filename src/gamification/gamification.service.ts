import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PointsLog } from './interfaces/points-log.interface';

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  // Função pura para calcular o nível com base no XP total
  calculateLevel(totalXp: number): number {
    if (totalXp <= 0) return 0;
    // Inverso da fórmula: Nível = sqrt(XP / 100)
    return Math.floor(Math.sqrt(totalXp / 100));
  }

  async addMultiplePoints(tx: any, userId: string, logs: PointsLog[]) {
    let totalPoints = 0;

    for (const log of logs) {
      totalPoints += log.amount;

      await tx.pointsLog.create({
        data: {
          userId,
          amount: log.amount,
          type: log.type,
          description: log.description,
          receiptId: log.receiptId,
          actionType: log.actionType,
        },
      });
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        totalXp: {
          increment: totalPoints,
        },
        points: {
          increment: totalPoints,
        },
      },
    });

    const newLevel = this.calculateLevel(updatedUser.totalXp);

    if (newLevel > updatedUser.level) {
      await tx.user.update({
        where: { id: userId },
        data: {
          level: newLevel,
        },
      });
    }

    return updatedUser;
  }
}
