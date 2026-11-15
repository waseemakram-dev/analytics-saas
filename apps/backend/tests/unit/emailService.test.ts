import { describe, it, expect, beforeEach } from "vitest";
import { emailService } from "@/server/email/emailService";

describe("Email Delivery Abstraction (Mock Mode)", () => {
  beforeEach(() => {
    emailService.clearHistory();
  });

  it("should record dispatched verification emails with valid URLs", async () => {
    const rawToken = "sample_verification_token_123";
    const email = "user@test.com";

    const sent = await emailService.sendVerificationEmail(email, rawToken);
    expect(sent).toBe(true);

    const history = emailService.getSentEmails();
    expect(history).toHaveLength(1);
    expect(history[0].to).toBe(email);
    expect(history[0].actionUrl).toContain("/verify-email");
    expect(history[0].actionUrl).toContain("token=sample_verification_token_123");
  });

  it("should record dispatched password reset emails with valid URLs", async () => {
    const rawToken = "sample_reset_token_456";
    const email = "forgot@test.com";

    const sent = await emailService.sendPasswordResetEmail(email, rawToken);
    expect(sent).toBe(true);

    const history = emailService.getSentEmails();
    expect(history).toHaveLength(1);
    expect(history[0].to).toBe(email);
    expect(history[0].actionUrl).toContain("/reset-password");
    expect(history[0].actionUrl).toContain("token=sample_reset_token_456");
  });
});
