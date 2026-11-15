import { prisma } from "@/server/database/prisma";
import { AppError } from "@/lib/errors/appError";
import { hashPassword } from "../utils/password";
import { generateSecureToken, hashToken, createExpiryDate } from "../utils/tokens";
import { emailService } from "@/server/email/emailService";
import { registerSchema, RegisterInput } from "../validators/authSchemas";

export interface SafeUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  role: string;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    slug: string;
    role: string;
  };
}

export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  // 1. Strict validation
  const validated = registerSchema.parse(input);
  const normalizedEmail = validated.email.trim().toLowerCase();

  // 2. Duplicate account check
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw AppError.conflict("An account with this email already exists");
  }

  // 3. Hash password using Argon2id
  const passwordHash = await hashPassword(validated.password);

  // 4. Generate verification token (raw token sent to user, hash stored in DB)
  const rawVerificationToken = generateSecureToken(32);
  const hashedVerificationToken = hashToken(rawVerificationToken);
  const tokenExpires = createExpiryDate(24 * 60); // 24 hours

  // 5. Generate workspace slug
  const workspaceSlug = `${normalizedEmail.split("@")[0].replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

  // 6. Execute atomic transaction (User + Personal Workspace + Membership + Verification Token)
  const result = await prisma.$transaction(async (tx) => {
    // A. Create User
    const user = await tx.user.create({
      data: {
        name: validated.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "USER",
      },
    });

    // B. Create Personal Workspace
    const workspace = await tx.workspace.create({
      data: {
        name: `${validated.name.trim()}'s Workspace`,
        slug: workspaceSlug,
      },
    });

    // C. Create Membership with OWNER role
    const membership = await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    // D. Create Verification Token record
    await tx.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: hashedVerificationToken,
        expires: tokenExpires,
      },
    });

    return { user, workspace, membership };
  });

  // 7. Dispatch verification email (non-blocking for registration transaction)
  await emailService.sendVerificationEmail(normalizedEmail, rawVerificationToken);

  // 8. Return safe sanitized response (no passwordHash or tokens)
  return {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    emailVerified: result.user.emailVerified,
    image: result.user.image,
    role: result.user.role,
    createdAt: result.user.createdAt,
    workspace: {
      id: result.workspace.id,
      name: result.workspace.name,
      slug: result.workspace.slug,
      role: result.membership.role,
    },
  };
}
