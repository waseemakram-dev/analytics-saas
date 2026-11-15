import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GroqProvider } from "@/server/ai/providers/groqProvider";
import { AiProviderFactory } from "@/server/ai/providers/aiProviderFactory";

// Mock groq-sdk
const mockCreate = vi.fn();
vi.mock("groq-sdk", () => {
  return {
    default: class MockGroq {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe("AI Provider Architecture (GroqProvider & AiProviderFactory)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should fail gracefully with AI_CONFIG_MISSING if GROQ_API_KEY is unset", async () => {
    delete process.env.GROQ_API_KEY;
    const provider = new GroqProvider();

    await expect(
      provider.generateInsights("System", "User")
    ).rejects.toThrow("Groq AI service is not configured");
  });

  it("should successfully generate insights with token consumption metadata", async () => {
    process.env.GROQ_API_KEY = "test_mock_key";
    process.env.AI_MODEL = "openai/gpt-oss-120b";

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Healthy traffic performance across the last 30 days.",
              insights: [],
              limitations: [],
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 80,
        total_tokens: 230,
      },
    });

    const provider = new GroqProvider();
    const result = await provider.generateInsights("System prompt", "User prompt");

    expect(result.provider).toBe("groq");
    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(result.promptTokens).toBe(150);
    expect(result.completionTokens).toBe(80);
    expect(result.totalTokens).toBe(230);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.rawContent).toContain("Healthy traffic performance");
  });

  it("should map HTTP 429 rate limit errors to domain AI_RATE_LIMIT_EXCEEDED", async () => {
    process.env.GROQ_API_KEY = "test_mock_key";

    const rateLimitError: any = new Error("Rate limit exceeded");
    rateLimitError.status = 429;
    mockCreate.mockRejectedValue(rateLimitError);

    const provider = new GroqProvider();

    await expect(
      provider.generateInsights("System prompt", "User prompt")
    ).rejects.toThrow("Groq Free Plan rate limit reached");
  });

  it("should resolve registered providers from AiProviderFactory", () => {
    process.env.AI_PROVIDER = "groq";
    const provider = AiProviderFactory.getProvider();
    expect(provider.name).toBe("groq");
  });

  it("should reject unsupported provider names", () => {
    expect(() => AiProviderFactory.getProvider("unknown_ai")).toThrow(
      "AI provider 'unknown_ai' is not registered"
    );
  });
});
