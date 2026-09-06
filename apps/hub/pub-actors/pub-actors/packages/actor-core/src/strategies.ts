import { z } from "zod";

export const ExtractionStrategyNameSchema = z.enum([
  "html",
  "hydration",
  "network",
  "dom",
  "browser-engine",
  "residential",
  "external-provider",
]);

export type ExtractionStrategyName = z.infer<typeof ExtractionStrategyNameSchema>;

export const StrategyExecutionResultSchema = z.object({
  strategy: ExtractionStrategyNameSchema,
  success: z.boolean(),
  blocked: z.boolean(),
  recordsFound: z.number().int().nonnegative(),
  recordsValid: z.number().int().nonnegative(),
  fieldsFound: z.array(z.string()),
  fieldsMissing: z.array(z.string()),
  costUsd: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  blockReason: z.string().nullable(),
  error: z.string().nullable(),
  rawOutput: z.any().optional(),
});

export type StrategyExecutionResult = z.infer<typeof StrategyExecutionResultSchema>;

export interface IExtractionStrategy<TInput, TOutput> {
  readonly name: ExtractionStrategyName;
  readonly description: string;
  readonly estimatedCostUsdPerItem: number;
  execute(input: TInput): Promise<{
    result: StrategyExecutionResult;
    data?: TOutput;
  }>;
}

/**
 * Multi-Strategy Pipeline Runner
 * Tries strategies progressively from lowest cost (HTML/API) to highest cost (Residential/Anti-Detect/External)
 */
export class StrategyPipelineRunner<TInput, TOutput> {
  constructor(private strategies: IExtractionStrategy<TInput, TOutput>[]) {}

  async run(input: TInput): Promise<{
    success: boolean;
    executedStrategy: ExtractionStrategyName | null;
    history: StrategyExecutionResult[];
    data?: TOutput;
  }> {
    const history: StrategyExecutionResult[] = [];

    for (const strategy of this.strategies) {
      try {
        const execution = await strategy.execute(input);
        history.push(execution.result);

        if (execution.result.success && !execution.result.blocked && execution.data) {
          return {
            success: true,
            executedStrategy: strategy.name,
            history,
            data: execution.data,
          };
        }
      } catch (err: any) {
        history.push({
          strategy: strategy.name,
          success: false,
          blocked: false,
          recordsFound: 0,
          recordsValid: 0,
          fieldsFound: [],
          fieldsMissing: ["all"],
          costUsd: 0,
          durationMs: 0,
          blockReason: null,
          error: err?.message || String(err),
        });
      }
    }

    return {
      success: false,
      executedStrategy: null,
      history,
    };
  }
}
