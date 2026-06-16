export interface IProductItem {
  name: string;
  ean: string | null;
  cod: string | null;
  price: number;
  quantity: number;
  unitPrice: number;
  unit: string | null;
}

// Criaremos esta nova interface para representar o retorno da SEFAZ
export interface ISefazScrapeResult {
  marketName: string | undefined;
  marketFantasyName?: string | undefined;
  cnpj: string | undefined;
  emissionDate: string | undefined;
  CEP?: string | undefined;
  products: IProductItem[];
}
