import { ExtractionStrategyName } from "../../../actor-core/src/strategies.js";

export interface CostReport {
  strategy: ExtractionStrategyName;
  estimatedCostUsd: number;
  actualCostUsd: number;
  currency: string;
  isEconomical: boolean;
}

export class CostEstimator {
  private static readonly STRATEGY_BASE_RATES: Record<ExtractionStrategyName, number> = {
    html: 0.0001,
    hydration: 0.0002,
    network: 0.0005,
    dom: 0.002,
    "browser-engine": 0.0025,
    residential: 0.005,
    "external-provider": 0.0085,
  };

  static estimate(strategy: ExtractionStrategyName, customMultiplier = 1.0): number {
    const base = this.STRATEGY_BASE_RATES[strategy] ?? 0.001;
    return base * customMultiplier;
  }

  static generateReport(strategy: ExtractionStrategyName, actualCostUsd: number): CostReport {
    const estimated = this.estimate(strategy);
    return {
      strategy,
      estimatedCostUsd: estimated,
      actualCostUsd,
      currency: "USD",
      isEconomical: actualCostUsd <= estimated * 1.5,
    };
  }
}
