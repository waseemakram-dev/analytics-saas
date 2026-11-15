import { IAiProvider } from "./aiProvider.interface";
import { groqProvider } from "./groqProvider";
import { AppError } from "@/lib/errors/appError";

export class AiProviderFactory {
  private static providers: Map<string, IAiProvider> = new Map([
    ["groq", groqProvider],
  ]);

  /**
   * Registers a new provider into the factory registry.
   */
  static registerProvider(name: string, provider: IAiProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  /**
   * Retrieves the active AI provider based on AI_PROVIDER environment variable.
   */
  static getProvider(name?: string): IAiProvider {
    const target = (name || process.env.AI_PROVIDER || "groq").toLowerCase();
    const provider = this.providers.get(target);

    if (!provider) {
      throw new AppError(
        `AI provider '${target}' is not registered or supported.`,
        500,
        "UNSUPPORTED_AI_PROVIDER"
      );
    }

    return provider;
  }
}
