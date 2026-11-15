import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUser } from "@/server/auth/services/registrationService";
import { verifyEmail, resendVerificationEmail } from "@/server/auth/services/verificationService";
import { requestPasswordReset, resetPassword } from "@/server/auth/services/passwordResetService";
import {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from "@/server/auth/services/profileService";
import { requireWorkspaceAccess } from "@/server/security/guards";
import { prisma } from "@/server/database/prisma";
import { emailService } from "@/server/email/emailService";
import { hashToken } from "@/server/auth/utils/tokens";
import { hashPassword } from "@/server/auth/utils/password";

// Mock auth from "@/auth" to prevent next-auth runtime resolution in vitest
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock the prisma client for isolated unit/integration tests
vi.mock("@/server/database/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
      },
      workspaceMember: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      verificationToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      passwordResetToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe("Authentication Services & Authorization Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailService.clearHistory();
  });

  describe("User Registration", () => {
    it("should successfully register a user with workspace and dispatch email", async () => {
      // Mock no existing user
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const fakeUser = {
        id: "usr_123",
        name: "Test User",
        email: "test@domain.com",
        emailVerified: null,
        image: null,
        role: "USER",
        createdAt: new Date(),
      };
      const fakeWorkspace = {
        id: "ws_123",
        name: "Test User's Workspace",
        slug: "test-ws",
      };
      const fakeMembership = {
        id: "mem_123",
        workspaceId: "ws_123",
        userId: "usr_123",
        role: "OWNER",
      };

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue(fakeUser) },
          workspace: { create: vi.fn().mockResolvedValue(fakeWorkspace) },
          workspaceMember: { create: vi.fn().mockResolvedValue(fakeMembership) },
          verificationToken: { create: vi.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await registerUser({
        name: "Test User",
        email: "test@domain.com",
        password: "ValidPassword123!",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("usr_123");
      expect(result.email).toBe("test@domain.com");
      expect(result.workspace.role).toBe("OWNER");
      expect((result as any).passwordHash).toBeUndefined(); // Never leak passwordHash

      // Verify email was dispatched
      expect(emailService.getSentEmails()).toHaveLength(1);
    });

    it("should reject registration if email is already registered", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "existing_1",
        email: "existing@domain.com",
      } as any);

      await expect(
        registerUser({
          name: "Duplicate User",
          email: "existing@domain.com",
          password: "ValidPassword123!",
        })
      ).rejects.toThrow("An account with this email already exists");
    });
  });

  describe("Email Verification", () => {
    it("should successfully verify an unverified user and delete token", async () => {
      const rawToken = "my_secure_verification_token_123";
      const hashed = hashToken(rawToken);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr_123",
        email: "verify@domain.com",
        emailVerified: null,
      } as any);

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValueOnce({
        identifier: "verify@domain.com",
        token: hashed,
        expires: new Date(Date.now() + 3600000), // 1 hour in future
      } as any);

      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{}, {}]);

      const res = await verifyEmail({
        email: "verify@domain.com",
        token: rawToken,
      });

      expect(res.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should reject expired verification tokens", async () => {
      const rawToken = "expired_token_123";
      const hashed = hashToken(rawToken);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr_123",
        email: "verify@domain.com",
        emailVerified: null,
      } as any);

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValueOnce({
        identifier: "verify@domain.com",
        token: hashed,
        expires: new Date(Date.now() - 3600000), // Expired 1 hour ago
      } as any);

      await expect(
        verifyEmail({
          email: "verify@domain.com",
          token: rawToken,
        })
      ).rejects.toThrow("Verification token has expired");
    });
  });

  describe("Password Reset Flow", () => {
    it("should return generic message on forgot password even if email does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const res = await requestPasswordReset({ email: "unknown@domain.com" });
      expect(res.success).toBe(true);
      expect(res.message).toContain("If an account exists");
      // No email should be sent for unknown users
      expect(emailService.getSentEmails()).toHaveLength(0);
    });

    it("should dispatch reset email when user exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr_pwd",
        email: "exists@domain.com",
      } as any);

      const res = await requestPasswordReset({ email: "exists@domain.com" });
      expect(res.success).toBe(true);
      expect(emailService.getSentEmails()).toHaveLength(1);
    });

    it("should successfully reset password and invalidate existing sessions", async () => {
      const rawToken = "valid_reset_token_789";
      const hashed = hashToken(rawToken);

      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce({
        id: "tok_1",
        email: "reset@domain.com",
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr_reset",
        email: "reset@domain.com",
      } as any);

      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{}, {}, {}]);

      const res = await resetPassword({
        email: "reset@domain.com",
        token: rawToken,
        newPassword: "BrandNewSecurePassword123!",
      });

      expect(res.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("Profile & Workspace Authorization Guards", () => {
    it("should retrieve sanitized profile without passwordHash", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr_1",
        name: "Alice",
        email: "alice@domain.com",
        emailVerified: new Date(),
        image: null,
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceMembers: [],
      } as any);

      const profile = await getUserProfile("usr_1");
      expect(profile.name).toBe("Alice");
      expect((profile as any).passwordHash).toBeUndefined();
    });

    it("should block cross-tenant workspace access when user is not a member", async () => {
      // User is not in workspace
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        requireWorkspaceAccess("foreign_user_id", "workspace_123")
      ).rejects.toThrow("Access denied: You are not a member of this workspace");
    });

    it("should allow workspace access when user is a verified member", async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        id: "mem_1",
        workspaceId: "workspace_123",
        userId: "member_user_id",
        role: "OWNER",
        workspace: { id: "workspace_123", name: "My Workspace" },
      } as any);

      const membership = await requireWorkspaceAccess("member_user_id", "workspace_123");
      expect(membership).toBeDefined();
      expect(membership.role).toBe("OWNER");
    });
  });
});
