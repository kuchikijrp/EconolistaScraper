import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

async function reprocessDeadLetterQueue() {
  const ufTarget = process.env.UF_TARGET || 'go';
  const queueName = `nfe:queue:${ufTarget}`;
  const failedQueueName = `nfe:failed:${ufTarget}`;

  console.log(`🔄 Iniciando reprocessamento da Dead-Letter Queue (DLQ)`);
  console.log(`📍 Fila principal: ${queueName}`);
  console.log(`💀 Fila de falhas: ${failedQueueName}\n`);

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
      // Pega o último item que falhou
      const item = await redis.rpop(failedQueueName);
      
      if (!item) {
        break; // A fila de falhas está vazia
      }

      const job = JSON.parse(item);

      // Limpa os erros e reseta as tentativas
      const retryJob = {
        ...job,
        attempt: 1, // Reseta para a tentativa inicial
      };

      delete retryJob.failedAt;
      delete retryJob.error;

      // Joga de volta para a fila principal
      await redis.lpush(queueName, JSON.stringify(retryJob));
      reprocessedCount++;

      console.log(`✅ Reenfileirado: Recibo ${job.receiptId} (Erro anterior: ${job.error})`);
    }

    console.log(`\n🎉 Finalizado! ${reprocessedCount} notas foram enviadas de volta para a fila principal.`);
  } catch (error) {
    console.error('❌ Erro ao reprocessar a fila:', error);
  } finally {
    await redis.quit();
  }
}

reprocessDeadLetterQueue();
