import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";
import dotenv from "dotenv";
import "dotenv/config";

// Ensure .env is loaded whether running from workspace root or apps/backend
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
const testDbUrl = process.env.TEST_DATABASE_URL;

describe("Real PostgreSQL AI Database Tests (analytics_saas_test)", () => {
  let testPrisma: PrismaClient;
  let testWorkspaceId: string;
  let testUserId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    if (!testDbUrl) {
      throw new Error("TEST_DATABASE_URL is not configured.");
    }

    const adapter = new PrismaPg({ connectionString: testDbUrl });
    testPrisma = new PrismaClient({ adapter });

    // Clean up test data
    await testPrisma.aiUsageLog.deleteMany();
    await testPrisma.aiInsightCache.deleteMany();
    await testPrisma.analyticsCache.deleteMany();
    await testPrisma.connectedProperty.deleteMany();
    await testPrisma.integrationAccount.deleteMany();
    await testPrisma.workspaceMember.deleteMany();
    await testPrisma.workspace.deleteMany();
    await testPrisma.user.deleteMany();

    // Seed test user, workspace, and property
    const user = await testPrisma.user.create({
      data: {
        name: "AI Test User",
        email: "ai.tester@test.com",
      },
    });
    testUserId = user.id;

    const workspace = await testPrisma.workspace.create({
      data: {
        name: "AI Test Workspace",
        slug: "ai-test-workspace",
      },
    });
    testWorkspaceId = workspace.id;

    await testPrisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    const account = await testPrisma.integrationAccount.create({
      data: {
        workspaceId: workspace.id,
        provider: "google",
        providerAccountId: "google_sub_10987654321",
        email: "ai.tester@gmail.com",
        encryptedAccessToken: "enc_token",
        accessTokenIv: "iv_123",
        accessTokenTag: "tag_123",
      },
    });

    const property = await testPrisma.connectedProperty.create({
      data: {
        workspaceId: workspace.id,
        integrationAccountId: account.id,
        propertyId: "99887766",
        displayName: "Test AI Property",
      },
    });
    testPropertyId = property.id;
  });

  afterAll(async () => {
    if (testPrisma) {
      await testPrisma.aiUsageLog.deleteMany();
      await testPrisma.aiInsightCache.deleteMany();
      await testPrisma.connectedProperty.deleteMany();
      await testPrisma.integrationAccount.deleteMany();
      await testPrisma.workspaceMember.deleteMany();
      await testPrisma.workspace.deleteMany();
      await testPrisma.user.deleteMany();
      await testPrisma.$disconnect();
    }
  });

  it("should successfully insert and retrieve a cached AI insight", async () => {
    const queryHash = "test_hash_abcdef123456";
    const expiresAt = new Date(Date.now() + 6 * 3600 * 1000);

    const cached = await testPrisma.aiInsightCache.create({
      data: {
        workspaceId: testWorkspaceId,
        connectedPropertyId: testPropertyId,
        dateRange: "30d",
        language: "en",
        queryHash,
        provider: "groq",
        model: "openai/gpt-oss-120b",
        summary: "Test summary from PostgreSQL",
        insights: [{ type: "traffic", title: "Growth", explanation: "Up 20%" }],
        verifiedFacts: { fact_sessions: { value: 100 } },
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        expiresAt,
      },
    });

    expect(cached.id).toBeDefined();
    expect(cached.summary).toBe("Test summary from PostgreSQL");
    expect(cached.totalTokens).toBe(300);

    const retrieved = await testPrisma.aiInsightCache.findUnique({
      where: {
        connectedPropertyId_queryHash: {
          connectedPropertyId: testPropertyId,
          queryHash,
        },
      },
    });

    expect(retrieved?.id).toBe(cached.id);
    expect(retrieved?.language).toBe("en");
  });

  it("should record AI token usage logs", async () => {
    const log = await testPrisma.aiUsageLog.create({
      data: {
        workspaceId: testWorkspaceId,
        userId: testUserId,
        connectedPropertyId: testPropertyId,
        feature: "insights",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        promptTokens: 180,
        completionTokens: 90,
        totalTokens: 270,
        status: "SUCCESS",
        durationMs: 450,
      },
    });

    expect(log.id).toBeDefined();
    expect(log.totalTokens).toBe(270);
    expect(log.status).toBe("SUCCESS");

    const logs = await testPrisma.aiUsageLog.findMany({
      where: { workspaceId: testWorkspaceId },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("should cascade delete AI caches and logs when workspace is deleted", async () => {
    // Delete workspace
    await testPrisma.workspace.delete({
      where: { id: testWorkspaceId },
    });

    const caches = await testPrisma.aiInsightCache.findMany({
      where: { workspaceId: testWorkspaceId },
    });
    const logs = await testPrisma.aiUsageLog.findMany({
      where: { workspaceId: testWorkspaceId },
    });

    expect(caches).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });
});
