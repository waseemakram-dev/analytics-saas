import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as verifyEmailHandler, PUT as resendVerifyHandler } from "@/app/api/auth/verify-email/route";
import { POST as forgotPasswordHandler } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordHandler } from "@/app/api/auth/reset-password/route";
import { GET as getMeHandler, PATCH as patchMeHandler } from "@/app/api/users/me/route";
import { POST as changePasswordHandler } from "@/app/api/users/me/password/route";
import { GET as getWorkspacesHandler } from "@/app/api/workspaces/me/route";
import * as registrationService from "@/server/auth/services/registrationService";
import * as verificationService from "@/server/auth/services/verificationService";
import * as passwordResetService from "@/server/auth/services/passwordResetService";
import * as profileService from "@/server/auth/services/profileService";
import * as guards from "@/server/security/guards";
import { AppError } from "@/lib/errors/appError";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("Authentication & User API Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should return 201 with sanitized user on successful registration", async () => {
      const mockUser = {
        id: "usr_100",
        name: "Test User",
        email: "test@domain.com",
        emailVerified: null,
        image: null,
        role: "USER",
        createdAt: new Date(),
        workspace: { id: "ws_1", name: "Test Workspace", slug: "test-ws", role: "OWNER" },
      };

      vi.spyOn(registrationService, "registerUser").mockResolvedValueOnce(mockUser as any);

      const req = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Test User",
          email: "test@domain.com",
          password: "StrongPassword123!",
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.user.id).toBe("usr_100");
      expect(json.data.user.passwordHash).toBeUndefined();
    });

    it("should return 409 when registration fails due to duplicate email", async () => {
      vi.spyOn(registrationService, "registerUser").mockRejectedValueOnce(
        AppError.conflict("An account with this email already exists")
      );

      const req = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Test User",
          email: "duplicate@domain.com",
          password: "StrongPassword123!",
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("CONFLICT");
    });
  });

  describe("POST & PUT /api/auth/verify-email", () => {
    it("should return 200 on successful token verification", async () => {
      vi.spyOn(verificationService, "verifyEmail").mockResolvedValueOnce({
        success: true,
        message: "Email verified successfully",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: "user@domain.com", token: "valid_token_12345678" }),
      });

      const res = await verifyEmailHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe("Email verified successfully");
    });

    it("should return 200 on resending verification email", async () => {
      vi.spyOn(verificationService, "resendVerificationEmail").mockResolvedValueOnce({
        success: true,
        message: "If an unverified account exists with this email, a verification link has been sent.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/verify-email", {
        method: "PUT",
        body: JSON.stringify({ email: "user@domain.com" }),
      });

      const res = await resendVerifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("If an unverified account exists");
    });
  });

  describe("POST /api/auth/forgot-password & reset-password", () => {
    it("should return 200 on password reset request", async () => {
      vi.spyOn(passwordResetService, "requestPasswordReset").mockResolvedValueOnce({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "user@domain.com" }),
      });

      const res = await forgotPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("If an account exists");
    });

    it("should return 200 on completing password reset", async () => {
      vi.spyOn(passwordResetService, "resetPassword").mockResolvedValueOnce({
        success: true,
        message: "Password has been successfully reset.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: "user@domain.com",
          token: "valid_token_12345678",
          newPassword: "BrandNewPassword123!",
        }),
      });

      const res = await resetPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("Password has been successfully reset");
    });
  });

  describe("GET /api/users/me (Protected Route)", () => {
    it("should return 401 when request is unauthenticated", async () => {
      vi.spyOn(guards, "getAuthenticatedUser").mockRejectedValueOnce(
        AppError.unauthorized("Authentication required to access this resource")
      );

      const res = await getMeHandler();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 200 with profile when authenticated", async () => {
      vi.spyOn(guards, "getAuthenticatedUser").mockResolvedValueOnce({
        userId: "usr_1",
        email: "authed@domain.com",
        role: "USER",
      });

      vi.spyOn(profileService, "getUserProfile").mockResolvedValueOnce({
        id: "usr_1",
        name: "Authed User",
        email: "authed@domain.com",
        emailVerified: new Date(),
        image: null,
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceMembers: [],
      } as any);

      const res = await getMeHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.name).toBe("Authed User");
    });
  });

  describe("GET /api/workspaces/me (Protected Route)", () => {
    it("should return user workspaces when authenticated", async () => {
      vi.spyOn(guards, "getAuthenticatedUser").mockResolvedValueOnce({
        userId: "usr_1",
        email: "authed@domain.com",
        role: "USER",
      });

      vi.spyOn(profileService, "getUserWorkspaces").mockResolvedValueOnce([
        {
          workspaceId: "ws_1",
          name: "Main Workspace",
          slug: "main-ws",
          role: "OWNER",
          joinedAt: new Date(),
        },
      ] as any);

      const res = await getWorkspacesHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].role).toBe("OWNER");
    });
  });
});
