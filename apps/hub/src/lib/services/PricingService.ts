export class PricingService {
  /**
   * Calcula o preço base PUB a partir do custo do fornecedor.
   * Regra base: markup sobre o custo.
   * Futuramente pode envolver taxas, frete estimado, etc.
   */
  static calculatePubBasePrice(supplierCost: number): number {
    // Exemplo: 30% de margem sobre o custo para a plataforma PUB
    const platformMarkup = 1.3;
    return Number((supplierCost * platformMarkup).toFixed(2));
  }

  static normalize(price: number | string): number {
    const val =
      typeof price === "string"
        ? parseFloat(price.replace(/[^\d.,]/g, "").replace(",", "."))
        : price;
    return isNaN(val) ? 0 : val;
  }
}
