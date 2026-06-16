export interface ISefazStrategy {
  execute(url: string): Promise<any>;
}
