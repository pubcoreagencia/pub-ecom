export interface ExecutionResult<T> {
  data: T[];
  totalFound: number;
  errors: string[];
  metadata: Record<string, any>;
}

export interface ExecutionProvider<T> {
  execute(params: Record<string, any>): Promise<ExecutionResult<T>>;
}
