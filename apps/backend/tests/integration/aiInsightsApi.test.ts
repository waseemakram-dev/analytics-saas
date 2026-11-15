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
    },
    connectedProperty: {
      findFirst: vi.fn(),
    },
    aiInsightCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    aiUsageLog: {
      create: vi.fn(),
    },
  },
}));

// Mock aiInsightsService
vi.mock("@/server/ai/services/aiInsightsService", () => ({
  aiInsightsService: {
    generateInsights: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/server/database/prisma";
import { aiInsightsService } from "@/server/ai/services/aiInsightsService";
import { POST } from "@/app/api/ai/insights/route";
import { rateLimiter } from "@/server/security/rateLimiter";

describe("AI Insights API Route (POST /api/ai/insights)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3001/api/ai/insights", {
      method: "POST",
      body: JSON.stringify({ propertyId: "prop_123" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("UNAUTHORIZED");
  });

  it("should return 400 on missing or invalid payload", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_123", email: "test@domain.com" },
    } as any);

    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      workspaceId: "ws_123",
      userId: "user_123",
      role: "OWNER",
    } as any);

    // Empty body (missing propertyId)
    const req = new NextRequest("http://localhost:3001/api/ai/insights", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("should return 404 if property does not belong to user active workspace", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_123", email: "test@domain.com" },
    } as any);

    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      workspaceId: "ws_123",
      userId: "user_123",
      role: "OWNER",
    } as any);

    // Property not found in workspace
    vi.mocked(prisma.connectedProperty.findFirst).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3001/api/ai/insights", {
      method: "POST",
      body: JSON.stringify({ propertyId: "unauthorized_prop" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("NOT_FOUND");
  });

  it("should return 200 with structured insights on valid authorized request", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_123", email: "test@domain.com" },
    } as any);

    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      workspaceId: "ws_123",
      userId: "user_123",
      role: "OWNER",
    } as any);

    vi.mocked(prisma.connectedProperty.findFirst).mockResolvedValueOnce({
      id: "prop_db_123",
      workspaceId: "ws_123",
      propertyId: "564325115",
      displayName: "My Site",
    } as any);

    const mockResult = {
      propertyId: "prop_db_123",
      dateRange: { startDate: "2026-10-15", endDate: "2026-11-14", label: "30d" },
      language: "en",
      generatedAt: new Date().toISOString(),
      dataFetchedAt: new Date().toISOString(),
      provider: "groq",
      model: "openai/gpt-oss-120b",
      summary: "Steady traffic across the last 30 days.",
      insights: [
        {
          type: "traffic",
          severity: "positive",
          title: "Good Traffic",
          explanation: "Sessions were strong.",
          factReferences: ["fact_total_sessions"],
          recommendations: ["Keep it up"],
        },
      ],
      verifiedFacts: {},
      limitations: [],
      cache: { hit: false },
    };

    vi.mocked(aiInsightsService.generateInsights).mockResolvedValueOnce(mockResult as any);

    const req = new NextRequest("http://localhost:3001/api/ai/insights", {
      method: "POST",
      body: JSON.stringify({
        propertyId: "prop_db_123",
        dateRange: "30d",
        language: "en",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.summary).toBe("Steady traffic across the last 30 days.");
    expect(json.data.provider).toBe("groq");
  });

  it("should enforce rate limiting and return 429 when workspace limit is exceeded", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_123", email: "test@domain.com" },
    } as any);

    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      workspaceId: "ws_limited",
      userId: "user_123",
      role: "OWNER",
    } as any);

    // Force rate limit
    vi.spyOn(rateLimiter, "isRateLimited").mockReturnValueOnce(true);

    const req = new NextRequest("http://localhost:3001/api/ai/insights", {
      method: "POST",
      body: JSON.stringify({ propertyId: "prop_123" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error?.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
