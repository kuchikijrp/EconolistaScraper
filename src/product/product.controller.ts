import { Controller } from '@nestjs/common';
import { ProductCatalogService } from './services/product-catalog.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductCatalogService) {}
}
