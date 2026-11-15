import { prisma } from "@/server/database/prisma";
import { AppError } from "@/lib/errors/appError";
import { hashPassword } from "../utils/password";
import { hashToken, generateSecureToken, createExpiryDate } from "../utils/tokens";
import { emailService } from "@/server/email/emailService";
import { rateLimiter } from "@/server/security/rateLimiter";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "../validators/authSchemas";

export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<{ success: boolean; message: string }> {
  const validated = forgotPasswordSchema.parse(input);
  const normalizedEmail = validated.email.trim().toLowerCase();

  // Rate limiting: 3 reset requests per 15 minutes per email
  const rateLimitKey = `forgot-pwd:${normalizedEmail}`;
  if (rateLimiter.isRateLimited(rateLimitKey, 3, 15 * 60 * 1000)) {
    throw AppError.tooManyRequests("Too many password reset requests. Please try again later.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Prevent email enumeration: return generic success even if user not found
  if (!user) {
    return {
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  }

  // Invalidate any previously generated reset tokens for this email
  await prisma.passwordResetToken.deleteMany({
    where: { email: normalizedEmail },
  });

  // Generate new secure token (1-hour expiration)
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = createExpiryDate(60); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      email: normalizedEmail,
      tokenHash,
      expiresAt,
    },
  });

  await emailService.sendPasswordResetEmail(normalizedEmail, rawToken);

  return {
    success: true,
    message: "If an account exists with this email, a password reset link has been sent.",
  };
}

export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ success: boolean; message: string }> {
  const validated = resetPasswordSchema.parse(input);
  const normalizedEmail = validated.email.trim().toLowerCase();
  const hashedInputToken = hashToken(validated.token);

  // 1. Find valid reset token by hash
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashedInputToken },
  });

  if (!tokenRecord || tokenRecord.email !== normalizedEmail) {
    throw AppError.badRequest("Invalid or expired password reset link", "INVALID_TOKEN");
  }

  // 2. Check token expiry
  if (new Date() > tokenRecord.expiresAt) {
    await prisma.passwordResetToken.delete({
      where: { id: tokenRecord.id },
    });
    throw AppError.badRequest("Password reset link has expired. Please request a new one.", "TOKEN_EXPIRED");
  }

  // 3. Find user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  // 4. Hash new password with Argon2id
  const newPasswordHash = await hashPassword(validated.newPassword);

  // 5. Atomic update: update password, delete token, and invalidate all existing sessions
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { id: tokenRecord.id },
    }),
    // Invalidate existing sessions so stolen cookies cannot be reused after password reset
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  return {
    success: true,
    message: "Password has been successfully reset. You can now log in with your new password.",
  };
}
