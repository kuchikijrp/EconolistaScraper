import { NfeQueueJob } from '../interfaces/nfe-queue-job.interface';

export function parseQueueJob(payload: string): NfeQueueJob | null {
  try {
    const raw: unknown = JSON.parse(payload);
    return validateQueueJob(raw);
  } catch {
    return null;
  }
}

function validateQueueJob(raw: unknown): NfeQueueJob | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;

  if (typeof data.url !== 'string' || !data.url.trim()) {
    return null;
  }

  if (typeof data.receiptId !== 'string' || !data.receiptId.trim()) {
    return null;
  }

  if (typeof data.userId !== 'string' || !data.userId.trim()) {
    return null;
  }

  const attempt =
    typeof data.attempt === 'number' && data.attempt >= 1
      ? Math.floor(data.attempt)
      : 1;

  return {
    url: data.url.trim(),
    receiptId: data.receiptId.trim(),
    userId: data.userId.trim(),
    attempt,
  };
}
