export type ReceiptRecencyReason = 'OLD_RECEIPT' | 'DOUBLE_XP' | 'NORMAL';

export interface ReceiptRecencyEvaluation {
  /** NEW_SKU e PRICE_UPDATE — desligado em notas frias (> 7 dias). */
  allowBonusPoints: boolean;
  /** Multiplicador para bônus de catálogo/preço. */
  multiplier: number;
  /** Multiplicador do envio (SCAN_NF); nota fria usa 1 (só pontos padrão). */
  scanMultiplier: number;
  reason: ReceiptRecencyReason;
}
