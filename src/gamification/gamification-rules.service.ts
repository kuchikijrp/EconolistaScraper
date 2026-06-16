import { Injectable } from '@nestjs/common';

import { differenceInMinutes, differenceInDays } from 'date-fns';

import { ReceiptRecencyEvaluation } from './interfaces/receipt-recency.interface';

@Injectable()
export class GamificationRulesService {
  private readonly MAX_DAYS = 7;

  private readonly DOUBLE_XP_MINUTES = 60;

  readonly basePoints = {
    scanNf: 5,
    newSku: 10,
    priceUpdatePerSku: 2,
  } as const;

  evaluateReceiptRecency(issueDate: Date): ReceiptRecencyEvaluation {
    const now = new Date();

    const minutes = differenceInMinutes(now, issueDate);

    const days = differenceInDays(now, issueDate);

    // 🚫 Nota fria: envio com pontos padrão; sem bônus de catálogo/preço
    if (days > this.MAX_DAYS) {
      return {
        allowBonusPoints: false,
        multiplier: 0,
        scanMultiplier: 1,
        reason: 'OLD_RECEIPT',
      };
    }

    // 🔥 Nota quente (≤ 60 min)
    if (minutes <= this.DOUBLE_XP_MINUTES) {
      return {
        allowBonusPoints: true,
        multiplier: 2,
        scanMultiplier: 2,
        reason: 'DOUBLE_XP',
      };
    }

    // ✅ Nota recente
    return {
      allowBonusPoints: true,
      multiplier: 1,
      scanMultiplier: 1,
      reason: 'NORMAL',
    };
  }

  scoreScanPoints(
    baseAmount: number,
    recency: ReceiptRecencyEvaluation,
  ): number {
    if (baseAmount <= 0) {
      return 0;
    }

    return Math.floor(baseAmount * recency.scanMultiplier);
  }

  scoreBonusPoints(
    baseAmount: number,
    recency: ReceiptRecencyEvaluation,
  ): number {
    if (!recency.allowBonusPoints || baseAmount <= 0) {
      return 0;
    }

    return Math.floor(baseAmount * recency.multiplier);
  }

  /** @deprecated Use scoreScanPoints ou scoreBonusPoints */
  applyMultiplier(
    baseAmount: number,
    recency: ReceiptRecencyEvaluation,
  ): number {
    return this.scoreBonusPoints(baseAmount, recency);
  }

  scorePoints(baseAmount: number, issueDate: Date): number {
    return this.scoreBonusPoints(
      baseAmount,
      this.evaluateReceiptRecency(issueDate),
    );
  }
}
