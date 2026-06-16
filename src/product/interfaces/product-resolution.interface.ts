export interface ProductResolution {
  id: string;
  isNew: boolean;
}

export interface RawProductReference {
  id: string;
  productId: string | null;
}
