import { ReceiptRecencyReason } from 'src/gamification/interfaces/receipt-recency.interface';

export interface SaveScrapedDataResult {
  pointsEarned: number;
  pointsBreakdown: Record<string, number>;
  pointsRecency: {
    allowBonusPoints: boolean;
    multiplier: number;
    scanMultiplier: number;
    reason: ReceiptRecencyReason;
  };
}
