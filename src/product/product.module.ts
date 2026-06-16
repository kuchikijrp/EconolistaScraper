import { Module } from '@nestjs/common';
import { ProductCatalogService } from './services/product-catalog.service';
import { ProductRawService } from './services/product-raw.service';
import { ProductController } from './product.controller';

@Module({
  controllers: [ProductController],
  providers: [ProductCatalogService, ProductRawService],
  exports: [ProductCatalogService, ProductRawService],
})
export class ProductModule {}
