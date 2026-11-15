import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock @/auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/server/database/prisma", () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    integrationAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    connectedProperty: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    analyticsCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    integrationSyncLog: {
      create: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/server/database/prisma";
import { GET as connectHandler } from "@/app/api/integrations/google/connect/route";
import { GET as callbackHandler } from "@/app/api/integrations/google/callback/route";
import { GET as accountsHandler } from "@/app/api/integrations/google/accounts/route";
import { POST as linkPropertyHandler } from "@/app/api/integrations/google/properties/link/route";
import { GET as overviewHandler } from "@/app/api/analytics/overview/route";

describe("GA4 Backend API Route Handlers", () => {
  const mockUser = { id: "user_mock_123", email: "user@test.local", role: "USER" };
  const mockWorkspace = { id: "ws_mock_123", name: "Test WS", slug: "test-ws" };
  const mockMembership = {
    id: "mem_123",
    workspaceId: mockWorkspace.id,
    userId: mockUser.id,
    role: "OWNER",
    workspace: mockWorkspace,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/integrations/google/connect", () => {
    it("should reject unauthenticated request with 401", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3001/api/integrations/google/connect");
      const res = await connectHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return Google authorization URL with signed state when authenticated", async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(mockMembership as any);

      const req = new NextRequest("http://localhost:3001/api/integrations/google/connect");
      const res = await connectHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.authorizationUrl).toContain("accounts.google.com");
      expect(json.data.authorizationUrl).toContain("analytics.readonly");
      expect(json.data.workspaceId).toBe(mockWorkspace.id);
    });
  });

  describe("GET /api/integrations/google/callback", () => {
    it("should handle Google user authorization rejection", async () => {
      const req = new NextRequest(
        "http://localhost:3001/api/integrations/google/callback?error=access_denied&error_description=User+cancelled&format=json"
      );
      const res = await callbackHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("OAUTH_DENIED");
    });

    it("should return error when missing code or state parameter", async () => {
      const req = new NextRequest(
        "http://localhost:3001/api/integrations/google/callback?format=json"
      );
      const res = await callbackHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe("GET /api/integrations/google/accounts", () => {
    it("should return connected accounts for the workspace", async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.integrationAccount.findMany).mockResolvedValue([
        {
          id: "int_acc_1",
          workspaceId: mockWorkspace.id,
          provider: "google",
          providerAccountId: "sub_123",
          email: "owner@gmail.com",
          status: "ACTIVE",
          expiresAt: new Date(),
          scope: "analytics.readonly",
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { properties: 1 },
        },
      ] as any);

      const req = new NextRequest("http://localhost:3001/api/integrations/google/accounts");
      const res = await accountsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.accounts).toHaveLength(1);
      expect(json.data.accounts[0].email).toBe("owner@gmail.com");
    });
  });

  describe("POST /api/integrations/google/properties/link", () => {
    it("should reject invalid request body with 400 validation error", async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue(mockMembership as any);

      const req = new NextRequest("http://localhost:3001/api/integrations/google/properties/link", {
        method: "POST",
        body: JSON.stringify({}), // Missing required propertyId and integrationAccountId
      });

      const res = await linkPropertyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should successfully link a GA4 property", async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.integrationAccount.findUnique).mockResolvedValue({
        id: "int_acc_1",
        workspaceId: mockWorkspace.id,
      } as any);
      vi.mocked(prisma.connectedProperty.count).mockResolvedValue(0);
      vi.mocked(prisma.connectedProperty.upsert).mockResolvedValue({
        id: "prop_1",
        workspaceId: mockWorkspace.id,
        propertyId: "12345678",
        displayName: "Production App",
        isDefault: true,
        currencyCode: "USD",
        timeZone: "America/New_York",
      } as any);

      const req = new NextRequest("http://localhost:3001/api/integrations/google/properties/link", {
        method: "POST",
        body: JSON.stringify({
          integrationAccountId: "int_acc_1",
          propertyId: "12345678",
          displayName: "Production App",
        }),
      });

      const res = await linkPropertyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.linked).toBe(true);
      expect(json.data.property.propertyId).toBe("12345678");
    });
  });

  describe("GET /api/analytics/overview", () => {
    it("should return 400 when no GA4 property is connected to workspace", async () => {
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.connectedProperty.findFirst).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3001/api/analytics/overview");
      const res = await overviewHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("No GA4 property is connected");
    });
  });
});
