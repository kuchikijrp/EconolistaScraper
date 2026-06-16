import { Injectable, Logger } from '@nestjs/common';

import { SefazGoStrategy } from './strategies/sefaz-go.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { GamificationService } from 'src/gamification/gamification.service';
import { GamificationRulesService } from 'src/gamification/gamification-rules.service';
import { PointsLog } from 'src/gamification/interfaces/points-log.interface';
import { ReceiptRecencyEvaluation } from 'src/gamification/interfaces/receipt-recency.interface';

import { ProductCatalogService } from 'src/product/services/product-catalog.service';
import { ProductRawService } from 'src/product/services/product-raw.service';
import {
  ProductResolution,
  RawProductReference,
} from 'src/product/interfaces/product-resolution.interface';
import { Prisma } from '@prisma/client';
import { SaveScrapedDataResult } from './interfaces/save-scraped-data-result.interface';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly goStrategy: SefazGoStrategy,
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly gamificationRulesService: GamificationRulesService,
    private readonly productCatalogService: ProductCatalogService,
    private readonly productRawService: ProductRawService,
  ) { }

  async processUrl(
    url: string,
    transactionId: string,
    userId: string,
  ): Promise<any> {
    try {
      const result = await this.goStrategy.execute(url, {
        transactionId,
        userId,
      });

      return { result };
    } catch (error) {
      this.logger.error({
        message: 'Erro ao processar URL da nota fiscal',
        transactionId,
        userId,
        error: error?.message,
      });

      throw error;
    }
  }

  async saveScrapedData(
    data: any,
    userId: string,
    transactionId: string,
  ): Promise<SaveScrapedDataResult> {
    const gamificationLogs: PointsLog[] = [];

    try {
      if (!data?.result?.cnpj) {
        throw new Error('CNPJ não encontrado na nota');
      }

      const { result } = data;

      let existingSkusCount = 0;

      const parsedIssueDate = this.parseIssueDate(result.emissionDate);
      const pointsRecency =
        this.gamificationRulesService.evaluateReceiptRecency(parsedIssueDate);
      const scoreBonus = (baseAmount: number) =>
        this.gamificationRulesService.scoreBonusPoints(
          baseAmount,
          pointsRecency,
        );

      if (pointsRecency.reason === 'OLD_RECEIPT') {
        this.logger.log({
          message:
            'Nota antiga — apenas pontos padrão de envio; bônus de catálogo/preço não aplicados',
          transactionId,
          issueDate: parsedIssueDate.toISOString(),
          reason: pointsRecency.reason,
        });
      }

      await this.prisma.$transaction(
        async (tx) => {
          // ✅ MERCADO
          const market = await tx.market.upsert({
            where: {
              cnpj: result.cnpj,
            },
            update: {
              name: result.marketName,
              fantasyName: result?.marketFantasyName,
            },
            create: {
              cnpj: result.cnpj,
              name: result.marketName,
              fantasyName: result?.marketFantasyName,
            },
          });

          const viacep = await fetch(`https://viacep.com.br/ws/${result.CEP}/json/`).then((res) => res.json()).catch(() => null);

          // ✅ Address (mesmo CNPJ pode ter mais de um endereço, então não é upsert)
          const address = await tx.address.upsert({
            where: {
              marketId: market.id,
              cep: result?.CEP,
            },
            update: {
              logradouro: viacep?.logradouro ?? null,
              complemento: viacep?.complemento ?? null,
              bairro: viacep?.bairro ?? null,
              cidade: viacep?.localidade ?? null,
              uf: viacep?.uf ?? null,
              estado: viacep?.estado ?? null,
              regiao: viacep?.regiao ?? null,
              ibge: viacep?.ibge ?? null,
            },
            create: {
              marketId: market.id,
              cep: result?.CEP,
              logradouro: viacep?.logradouro ?? null,
              complemento: viacep?.complemento ?? null,
              bairro: viacep?.bairro ?? null,
              cidade: viacep?.localidade ?? null,
              uf: viacep?.uf ?? null,
              estado: viacep?.estado ?? null,
              regiao: viacep?.regiao ?? null,
              ibge: viacep?.ibge ?? null,
            },
          });

          // 🔥 IDEMPOTÊNCIA
          await tx.priceEntry.deleteMany({
            where: {
              receiptId: transactionId,
            },
          });

          const productCache =
            await this.productCatalogService.resolveProductsBatch(
              tx,
              result.products,
            );
          const rawProductCache = new Map<string, RawProductReference>();

          const priceEntries: Prisma.PriceEntryCreateManyInput[] = [];

          for (const item of result.products) {
            const productData = item.ean
              ? (productCache.get(item.ean) ?? null)
              : null;

            const productCatalogId = productData?.id ?? null;

            // 🏅 GAMIFICAÇÃO de catálogo (nota fria não pontua bônus)
            if (pointsRecency.allowBonusPoints && productData?.isNew) {
              const newSkuPoints = scoreBonus(
                this.gamificationRulesService.basePoints.newSku,
              );

              if (newSkuPoints > 0) {
                gamificationLogs.push({
                  userId,
                  amount: newSkuPoints,
                  type: 'EARN',
                  description: this.buildPointsDescription(
                    `Novo produto: ${item.name}`,
                    pointsRecency,
                  ),
                  receiptId: transactionId,
                  actionType: 'NEW_SKU',
                });
              }

              // Mesmo EAN pode aparecer mais de uma vez na mesma nota
              if (item.ean) {
                productCache.set(item.ean, { ...productData, isNew: false });
              }
            } else if (productCatalogId) {
              existingSkusCount++;
            }

            // ✅ PRODUTO RAW
            let rawProduct = rawProductCache.get(item.name);
            if (!rawProduct) {
              rawProduct = await this.productRawService.resolveRawProduct(
                tx,
                item,
                productData?.id,
              );
              rawProductCache.set(item.name, rawProduct);
            }

            // ✅ PREÇO
            priceEntries.push({
              price: item.price,
              priceUnit: item.unitPrice,
              quantity: item.quantity,
              unit: item.unit,
              marketId: market.id,
              userId,
              receiptId: transactionId,
              productId: productData?.id ?? null,
              productRawId: rawProduct.id,
              issueDate: parsedIssueDate,
            });
          }

          await tx.priceEntry.createMany({ data: priceEntries });

          const scanPoints = this.gamificationRulesService.scoreScanPoints(
            this.gamificationRulesService.basePoints.scanNf,
            pointsRecency,
          );

          if (scanPoints > 0) {
            gamificationLogs.unshift({
              userId,
              amount: scanPoints,
              type: 'EARN',
              description: this.buildPointsDescription(
                `Envio de nota fiscal: ${result.marketName}`,
                pointsRecency,
              ),
              receiptId: transactionId,
              actionType: 'SCAN_NF',
            });
          }

          if (pointsRecency.allowBonusPoints && existingSkusCount > 0) {
            const priceUpdatePoints = scoreBonus(
              existingSkusCount *
              this.gamificationRulesService.basePoints.priceUpdatePerSku,
            );

            if (priceUpdatePoints > 0) {
              gamificationLogs.push({
                userId,
                amount: priceUpdatePoints,
                type: 'EARN',
                description: this.buildPointsDescription(
                  `Atualização de preços (${existingSkusCount} itens)`,
                  pointsRecency,
                ),
                receiptId: transactionId,
                actionType: 'PRICE_UPDATE',
              });
            }
          }

          if (gamificationLogs.length > 0) {
            await this.gamificationService.addMultiplePoints(
              tx,
              userId,
              gamificationLogs,
            );
          }

          // ✅ COMPLETED NO FINAL
          await tx.receipts.update({
            where: {
              id: transactionId,
            },
            data: {
              status: 'COMPLETED',
            },
          });
        },
        {
          timeout: 20000,
        },
      );

      return this.summarizePoints(gamificationLogs, pointsRecency);
    } catch (error) {
      await this.prisma.receipts.update({
        where: {
          id: transactionId,
        },
        data: {
          status: 'ERROR',
        },
      });

      this.logger.error({
        message: 'Falha crítica ao salvar dados da nota fiscal',
        transactionId,
        userId,
        error: error?.message,
        stack: error?.stack,
      });

      throw error;
    }
  }

  private summarizePoints(
    logs: PointsLog[],
    pointsRecency: ReceiptRecencyEvaluation,
  ): SaveScrapedDataResult {
    const pointsBreakdown: Record<string, number> = {};
    let pointsEarned = 0;

    for (const log of logs) {
      if (log.type !== 'EARN') {
        continue;
      }

      pointsEarned += log.amount;
      pointsBreakdown[log.actionType] =
        (pointsBreakdown[log.actionType] ?? 0) + log.amount;
    }

    return { pointsEarned, pointsBreakdown, pointsRecency };
  }

  private buildPointsDescription(
    base: string,
    recency: ReceiptRecencyEvaluation,
  ): string {
    if (recency.reason === 'DOUBLE_XP') {
      return `${base} (nota quente 2x)`;
    }

    return base;
  }

  private parseIssueDate(dateString?: string): Date {
    if (!dateString) {
      return new Date();
    }

    try {
      // Exemplo:
      // 16/02/2026 19:04:58-03:00

      const match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})\s(.+)$/);

      if (!match) {
        throw new Error('Formato de data inválido');
      }

      const [, day, month, year, time] = match;

      // ISO:
      // 2026-02-16T19:04:58-03:00

      const isoDate = `${year}-${month}-${day}T${time}`;

      const parsedDate = new Date(isoDate);

      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid Date');
      }

      return parsedDate;
    } catch (error) {
      this.logger.warn({
        message: 'Erro ao converter data da nota',
        originalDate: dateString,
        error: error?.message,
      });

      return new Date();
    }
  }
}
