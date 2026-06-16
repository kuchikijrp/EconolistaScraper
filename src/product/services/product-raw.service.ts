import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { RawProductReference } from '../interfaces/product-resolution.interface';
import { ProductInputDto } from '../dto/product-input.dto';

@Injectable()
export class ProductRawService {
  async resolveRawProduct(
    tx: Prisma.TransactionClient,
    item: ProductInputDto,
    productId?: string | null,
  ): Promise<RawProductReference> {
    // ✅ PRODUTO RAW
    const rawProduct = await tx.productRaw.upsert({
      where: {
        rawName: item.name,
      },
      update: {
        ...(productId
          ? {
              productId: productId,
            }
          : {}),
      },
      create: {
        rawName: item.name,
        productId: productId,
      },
    });
    return {
      id: rawProduct.id,
      productId: rawProduct.productId,
    };
  }
}
