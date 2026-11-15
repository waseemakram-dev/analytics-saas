import { describe, it, expect } from "vitest";
import Groq from "groq-sdk";
import path from "path";
import dotenv from "dotenv";
import "dotenv/config";

// Ensure .env is loaded whether running from workspace root or apps/backend
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });

describe("Live Groq Provider Connectivity Tests (Controlled & Minimal Tokens)", () => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.AI_MODEL || "openai/gpt-oss-120b";

  it("should authenticate and execute a minimal structured completion against live Groq API", async () => {
    if (!apiKey) {
      console.warn("Skipping live Groq test: GROQ_API_KEY is not set.");
      return;
    }

    const groq = new Groq({ apiKey });

    // Minimal JSON schema instruction to consume minimal tokens (< 200 tokens)
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'You are an AI analytics engine. Output only a JSON object matching exactly: {"status": "ok", "ping": "pong"}. Do not include markdown or reasoning outside the JSON.',
        },
        {
          role: "user",
          content: 'Return {"status": "ok", "ping": "pong"}.',
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1,
    });

    expect(completion.choices).toBeDefined();
    expect(completion.choices.length).toBeGreaterThan(0);

    const content = completion.choices[0]?.message?.content || "";
    expect(content.length).toBeGreaterThan(0);

    // Verify valid JSON output
    const parsed = JSON.parse(content);
    expect(parsed.status).toBe("ok");

    // Verify token usage metadata
    const usage = completion.usage;
    expect(usage).toBeDefined();
    expect(usage?.total_tokens).toBeGreaterThan(0);
    expect(usage?.total_tokens).toBeLessThan(1000); // Free-tier token safety bound
  });
});
