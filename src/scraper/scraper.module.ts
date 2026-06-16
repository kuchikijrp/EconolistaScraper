import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { SefazGoStrategy } from './strategies/sefaz-go.strategy';
import { GamificationModule } from 'src/gamification/gamification.module';
import { ProductCatalogService } from 'src/product/services/product-catalog.service';
import { ProductRawService } from 'src/product/services/product-raw.service';
import { ScraperWorkerService } from './scraper-worker.service';

// src/modules/scraper/scraper.module.ts
@Module({
  imports: [GamificationModule],
  controllers: [],
  providers: [
    ScraperService,
    ScraperWorkerService,
    SefazGoStrategy,
    ProductCatalogService,
    ProductRawService,
  ],
})
export class ScraperModule {}
