import { prisma } from "@/server/database/prisma";
import { AppError } from "@/lib/errors/appError";
import { hashToken, generateSecureToken, createExpiryDate } from "../utils/tokens";
import { emailService } from "@/server/email/emailService";
import { rateLimiter } from "@/server/security/rateLimiter";
import { verifyEmailSchema, resendVerificationSchema, VerifyEmailInput } from "../validators/authSchemas";

export async function verifyEmail(input: VerifyEmailInput): Promise<{ success: boolean; message: string }> {
  const validated = verifyEmailSchema.parse(input);
  const normalizedEmail = validated.email.trim().toLowerCase();
  const hashedInputToken = hashToken(validated.token);

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  if (user.emailVerified) {
    return { success: true, message: "Email is already verified" };
  }

  // 2. Find matching verification token
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: normalizedEmail,
        token: hashedInputToken,
      },
    },
  });

  if (!tokenRecord) {
    throw AppError.badRequest("Invalid or expired verification token", "INVALID_TOKEN");
  }

  // 3. Expiry check
  if (new Date() > tokenRecord.expires) {
    // Delete expired token to prevent replay
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: hashedInputToken,
        },
      },
    });
    throw AppError.badRequest("Verification token has expired. Please request a new one.", "TOKEN_EXPIRED");
  }

  // 4. Atomic verification: update user and delete token
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: hashedInputToken,
        },
      },
    }),
  ]);

  return { success: true, message: "Email verified successfully" };
}

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  const validated = resendVerificationSchema.parse({ email });
  const normalizedEmail = validated.email.trim().toLowerCase();

  // Rate limit: max 3 requests per 10 minutes per email
  const rateLimitKey = `resend-verify:${normalizedEmail}`;
  if (rateLimiter.isRateLimited(rateLimitKey, 3, 10 * 60 * 1000)) {
    throw AppError.tooManyRequests("Too many verification requests. Please wait a few minutes before trying again.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always return generic success message to prevent user enumeration
  if (!user || user.emailVerified) {
    return {
      success: true,
      message: "If an unverified account exists with this email, a verification link has been sent.",
    };
  }

  // Invalidate any existing verification tokens for this user
  await prisma.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  // Generate new token
  const rawToken = generateSecureToken(32);
  const hashedToken = hashToken(rawToken);
  const expires = createExpiryDate(24 * 60); // 24 hours

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token: hashedToken,
      expires,
    },
  });

  await emailService.sendVerificationEmail(normalizedEmail, rawToken);

  return {
    success: true,
    message: "If an unverified account exists with this email, a verification link has been sent.",
  };
}
