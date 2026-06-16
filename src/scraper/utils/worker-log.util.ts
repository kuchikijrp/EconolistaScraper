export function maskRedisHost(host?: string): string {
  if (!host?.trim()) {
    return '(não configurado)';
  }

  const value = host.trim();

  if (value.length <= 6) {
    return '***';
  }

  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function getFailedQueueName(queueName: string): string {
  return queueName.replace(':queue:', ':failed:');
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  return undefined;
}
