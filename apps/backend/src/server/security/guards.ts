import { auth } from "@/auth";
import { prisma } from "@/server/database/prisma";
import { AppError } from "@/lib/errors/appError";
import { WorkspaceRole } from "@prisma/client";

export interface AuthenticatedContext {
  userId: string;
  email: string;
  role: string;
}

/**
 * Asserts that a request is authenticated via an active session cookie.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedContext> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    throw AppError.unauthorized("Authentication required to access this resource");
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role || "USER",
  };
}

/**
 * Asserts that the authenticated user is an authorized member of the requested workspace.
 */
export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  requiredRole?: WorkspaceRole
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw AppError.forbidden("Access denied: You are not a member of this workspace");
  }

  if (requiredRole) {
    const roleHierarchy: Record<WorkspaceRole, number> = {
      MEMBER: 1,
      ADMIN: 2,
      OWNER: 3,
    };

    if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
      throw AppError.forbidden(`Insufficient workspace permissions. Required: ${requiredRole}`);
    }
  }

  return membership;
}

/**
 * Retrieves the user's primary or active workspace membership.
 */
export async function getUserActiveWorkspace(userId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    throw AppError.forbidden("No active workspace found for this user account.");
  }

  return member;
}

/**
 * Asserts that the requested GA4 property belongs to the specified workspace,
 * or resolves the workspace's default connected property.
 */
export async function requirePropertyAccess(workspaceId: string, propertyId?: string) {
  if (propertyId) {
    const cleanId = propertyId.replace(/^properties\//, "");
    const property = await prisma.connectedProperty.findFirst({
      where: {
        workspaceId,
        OR: [{ id: propertyId }, { propertyId: cleanId }],
      },
      include: {
        integrationAccount: true,
      },
    });

    if (!property) {
      throw AppError.notFound(`Connected GA4 property ${propertyId} not found in this workspace.`);
    }

    return property;
  }

  // Look for default property
  const defaultProp = await prisma.connectedProperty.findFirst({
    where: { workspaceId, isDefault: true },
    include: { integrationAccount: true },
  });

  if (defaultProp) return defaultProp;

  // Fallback to first property
  const firstProp = await prisma.connectedProperty.findFirst({
    where: { workspaceId },
    include: { integrationAccount: true },
  });

  if (!firstProp) {
    throw AppError.badRequest(
      "No GA4 property is connected to this workspace yet. Please connect your Google Analytics account first."
    );
  }

  return firstProp;
}

/**
 * Asserts that the user possesses the global system ADMIN role.
 */
export async function requireAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw AppError.forbidden("Access denied: Administrator privileges required");
  }

  return true;
}
