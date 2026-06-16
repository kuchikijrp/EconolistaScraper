import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MemoryLogger } from './logger/memory.logger';

async function bootstrap() {
  const logger = new MemoryLogger();

  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port, () => {
    logger.log(`Server is running on port ${port}`, 'Bootstrap');
  });
}
void bootstrap();
