import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { ISefazStrategy } from './isefaz.strategy';
import {
  ISefazScrapeResult,
  IProductItem,
} from '../interfaces/product-item.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SefazGoStrategy implements ISefazStrategy {
  private readonly logger = new Logger(SefazGoStrategy.name);

  constructor(private prisma: PrismaService) { }

  async execute(
    url: string,
    contextData?: { transactionId: string; userId: string },
  ): Promise<ISefazScrapeResult> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();

    try {
      // this.logger.log({
      //     message: 'Iniciando raspagem SEFAZ-GO',
      //     url,
      //     transactionId: contextData?.transactionId
      // });
      await this.prisma.receipts.update({
        where: { id: contextData?.transactionId },
        data: { status: 'PROCESSING' },
      });

      await page.goto(url, { waitUntil: 'networkidle' });

      // 👉 Clica no botão de detalhes (se existir)
      const btnDetalhes = page.locator('.btn.btn-info.btn-view-det');
      if ((await btnDetalhes.count()) > 0) {
        await btnDetalhes.click();
        await page.waitForTimeout(1500);
      }

      // 👉 Pega HTML completo (SEM depender de visibilidade)
      const html = await page.content();
      const $ = cheerio.load(html);

      // =========================
      // 🧾 DADOS DO MERCADO
      // =========================
      const getValueByLabel = (elemento: string, label: string): string => {
        const el = $(elemento)
          .find(`label:contains("${label}")`)
          .first()
          .next('span');

        return el.text().trim();
      };
      const emissionDate = getValueByLabel('#NFe', 'Data de Emissão');



      const marketName = getValueByLabel('#Emitente', 'Nome / Razão Social');
      const marketFantasyName = getValueByLabel('#Emitente', 'Nome Fantasia');
      const cnpj = getValueByLabel('#Emitente', 'CNPJ');
      const CEP = getValueByLabel('#Emitente', 'CEP');
      // =========================
      // 📦 PRODUTOS
      // =========================
      const products: IProductItem[] = [];

      const productTables = $('table.toggle.box');

      productTables.each((i, elem) => {
        const header = $(elem);

        // Nome do produto (robusto)
        const name = header.find('.fixo-prod-serv-descricao').text().trim();

        // tabela de detalhes geralmente vem logo após
        const details = header.next('table');

        const getDetail = (label: string) => {
          const el = details.find(`label:contains("${label}")`).next('span');
          return el.text().trim();
        };

        const eanRaw = getDetail('Código EAN Comercial');
        const codRaw = getDetail('Código do Produto');
        const quantityRaw = getDetail('Quantidade Comercial');
        const unitPriceRaw = getDetail('Valor unitário de comercialização');
        const PriceRaw = this.parseBrazilianNumber(unitPriceRaw) * this.parseBrazilianNumber(quantityRaw);
        const unitRaw = getDetail('Unidade Comercial')?.toUpperCase();

        if (!name) return;

        products.push({
          name,
          ean: eanRaw ? eanRaw.replace(/\D/g, '') : null,
          cod: codRaw ? codRaw.replace(/\D/g, '') : null,
          quantity: this.parseBrazilianNumber(quantityRaw),
          unitPrice: this.parseBrazilianNumber(unitPriceRaw),
          price: PriceRaw,
          unit: unitRaw,
        });
      });

      if (products.length === 0) {
        throw new Error(
          'Nenhum produto encontrado - possível mudança na estrutura da SEFAZ',
        );
      }

      return {
        marketName,
        marketFantasyName,
        cnpj: cnpj?.replace(/\D/g, ''),
        CEP: CEP?.replace(/\D/g, ''),
        emissionDate,
        products,
      };
    } catch (error) {
      this.logger.error({
        message: 'Erro na raspagem SEFAZ-GO',
        errorMessage: error.message,
        stack: error.stack,
        transactionId: contextData?.transactionId,
        attemptsStarted: contextData?.transactionId,
      });
      await this.prisma.receipts.update({
        where: { id: contextData?.transactionId },
        data: { status: 'ERROR' },
      });

      throw error;
    } finally {
      await browser.close();
    }
  }

  private parseBrazilianNumber(value: string | null): number {
    if (!value) return 0;

    const cleaned = value
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}
