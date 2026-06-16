/** Payload publicado na fila Redis (`nfe:queue:{uf}`). */
export interface NfeQueueJob {
  url: string;
  receiptId: string;
  userId: string;
  attempt: number;
}

/** Payload enviado para a dead-letter queue após esgotar tentativas. */
export interface NfeQueueJobFailed extends NfeQueueJob {
  failedAt: string;
  error?: string;
}
