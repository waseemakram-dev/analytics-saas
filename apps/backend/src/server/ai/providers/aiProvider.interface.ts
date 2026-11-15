export interface RawAiInsightResponse {
  rawContent: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
}

export interface IAiProvider {
  readonly name: string;
  readonly defaultModel: string;
  generateInsights(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; timeoutMs?: number }
  ): Promise<RawAiInsightResponse>;
}
