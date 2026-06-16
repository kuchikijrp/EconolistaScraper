import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ScraperModule } from './scraper/scraper.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScraperModule,
    GamificationModule,
    ProductModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
