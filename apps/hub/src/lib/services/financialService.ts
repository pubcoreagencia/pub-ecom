export interface SaleMetrics {
  gross_revenue: number;
  product_cost: number;
  shipping_cost: number;
  taxes: number;
  discounts: number;
  net_profit: number;
  influencer_share: number;
  operation_share: number;
}

export const calculateSaleMargins = (
  gross: number,
  cost: number,
  shipping: number,
  taxRate: number = 0.05,
): SaleMetrics => {
  const taxes = gross * taxRate;
  const discounts = 0; // Simplified for current phase
  const net_profit = gross - cost - shipping - taxes - discounts;

  // Rule: Influencer gets 50% of Net Profit
  const influencer_share = Math.max(0, net_profit * 0.5);
  const operation_share = net_profit - influencer_share;

  return {
    gross_revenue: gross,
    product_cost: cost,
    shipping_cost: shipping,
    taxes,
    discounts,
    net_profit,
    influencer_share,
    operation_share,
  };
};

export const mockFinancialSummary = {
  total_revenue: 1842900,
  total_net_profit: 536800,
  total_influencer_payout: 268400,
  profit_margin: "29.1%",
  top_stores: [
    { name: "Titanium Dropshipping", revenue: 428900, profit: 124000 },
    { name: "Glow Tech Hub", revenue: 312500, profit: 92400 },
    { name: "Urban Style", revenue: 284000, profit: 81200 },
  ],
};
