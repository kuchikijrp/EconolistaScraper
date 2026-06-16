import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ProductResolution } from '../interfaces/product-resolution.interface';
import { ProductInputDto } from '../dto/product-input.dto';

@Injectable()
export class ProductCatalogService {
  /**
   * Carrega/cria produtos do catálogo em lote (1 leitura + N creates só para EANs novos).
   * Mantém a mesma transação Prisma — reduz round-trips vs find/create por item.
   */
  async resolveProductsBatch(
    tx: Prisma.TransactionClient,
    items: ProductInputDto[],
  ): Promise<Map<string, ProductResolution>> {
    const catalog = new Map<string, ProductResolution>();
    const eanToItem = new Map<string, ProductInputDto>();

    for (const item of items) {
      if (item.ean && !eanToItem.has(item.ean)) {
        eanToItem.set(item.ean, item);
      }
    }

    if (eanToItem.size === 0) {
      return catalog;
    }

    const eans = [...eanToItem.keys()];

    const existing = await tx.product.findMany({
      where: { ean: { in: eans } },
      select: { id: true, ean: true },
    });

    for (const product of existing) {
      if (product.ean) {
        catalog.set(product.ean, { id: product.id, isNew: false });
      }
    }

    for (const ean of eans) {
      if (catalog.has(ean)) {
        continue;
      }

      const item = eanToItem.get(ean);
      if (!item) {
        continue;
      }

      const created = await tx.product.create({
        data: {
          ean,
          name: item.name,
          unit: item.unit,
        },
      });

      catalog.set(ean, { id: created.id, isNew: true });
    }

    return catalog;
  }

  async resolveProduct(
    tx: Prisma.TransactionClient,
    item: ProductInputDto,
  ): Promise<ProductResolution | null> {
    if (!item.ean) {
      return null;
    }

    const catalog = await this.resolveProductsBatch(tx, [item]);
    return catalog.get(item.ean) ?? null;
  }
}
