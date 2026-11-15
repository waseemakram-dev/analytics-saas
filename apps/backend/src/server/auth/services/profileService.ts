import { prisma } from "@/server/database/prisma";
import { AppError } from "@/lib/errors/appError";
import { verifyPassword, hashPassword } from "../utils/password";
import {
  updateProfileSchema,
  changePasswordSchema,
  UpdateProfileInput,
  ChangePasswordInput,
} from "../validators/authSchemas";

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      workspaceMembers: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  return user;
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const validated = updateProfileSchema.parse(input);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(validated.name !== undefined && { name: validated.name }),
      ...(validated.image !== undefined && { image: validated.image }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

export async function changeUserPassword(userId: string, input: ChangePasswordInput) {
  const validated = changePasswordSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  // If user only signed up via Google and has no password set
  if (!user.passwordHash) {
    throw AppError.badRequest(
      "Your account was created via Google Sign-In and does not have a current password. Please use password reset to establish a password."
    );
  }

  // Verify current password
  const isMatch = await verifyPassword(validated.currentPassword, user.passwordHash);
  if (!isMatch) {
    throw AppError.badRequest("Current password is incorrect", "INCORRECT_PASSWORD");
  }

  // Hash new password
  const newPasswordHash = await hashPassword(validated.newPassword);

  // Update password and invalidate all sessions except current if session DB is used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.session.deleteMany({
      where: { userId },
    }),
  ]);

  return { success: true, message: "Password updated successfully" };
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    workspaceId: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    joinedAt: m.createdAt,
  }));
}
