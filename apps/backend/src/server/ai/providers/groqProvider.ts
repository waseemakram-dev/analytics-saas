import Groq from "groq-sdk";
import { IAiProvider, RawAiInsightResponse } from "./aiProvider.interface";
import { AppError } from "@/lib/errors/appError";

export class GroqProvider implements IAiProvider {
  readonly name = "groq";
  readonly defaultModel: string;
  private groqClient: Groq | null = null;

  constructor() {
    this.defaultModel = process.env.AI_MODEL || "openai/gpt-oss-120b";
  }

  /**
   * Lazy initializes the Groq client with server-side validation.
   */
  private getClient(): Groq {
    if (this.groqClient) return this.groqClient;

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(
        "Groq AI service is not configured. Please set GROQ_API_KEY in the backend environment.",
        503,
        "AI_CONFIG_MISSING"
      );
    }

    this.groqClient = new Groq({ apiKey });
    return this.groqClient;
  }

  /**
   * Generates insights with retry and timeout protection.
   */
  async generateInsights(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens?: number; timeoutMs?: number } = {}
  ): Promise<RawAiInsightResponse> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || this.defaultModel;
    const maxTokens = options.maxTokens || 2048;
    const timeoutMs = options.timeoutMs || 25000;

    let attempts = 0;
    const maxAttempts = 2;
    const startTime = Date.now();

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const completion = await client.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: maxTokens,
            temperature: 0.2, // Low temperature for factual precision
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        const durationMs = Date.now() - startTime;
        const rawContent = completion.choices[0]?.message?.content || "";
        const usage = completion.usage;

        return {
          rawContent,
          provider: this.name,
          model,
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          durationMs,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Handle Abort / Timeout
        if (err.name === "AbortError" || controller.signal.aborted) {
          throw new AppError(
            `AI request timed out after ${timeoutMs / 1000}s. Please try again.`,
            504,
            "AI_TIMEOUT"
          );
        }

        // Handle Rate Limit (HTTP 429)
        const status = err.status || err.statusCode;
        if (status === 429) {
          if (attempts < maxAttempts) {
            // Wait 2 seconds before 1 bounded retry
            await new Promise((res) => setTimeout(res, 2000));
            continue;
          }
          throw new AppError(
            "Groq Free Plan rate limit reached. Please wait a moment before requesting more insights.",
            429,
            "AI_RATE_LIMIT_EXCEEDED"
          );
        }

        // Handle Service Unavailable (HTTP 503)
        if (status === 503 && attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, 1500));
          continue;
        }

        // Other Provider Errors
        throw new AppError(
          `AI Provider Error: ${err.message || "Failed to generate completion."}`,
          status && status >= 400 && status < 600 ? status : 502,
          "AI_PROVIDER_ERROR"
        );
      }
    }

    throw new AppError("Failed to complete AI request after retries.", 502, "AI_REQUEST_FAILED");
  }
}

export const groqProvider = new GroqProvider();
