import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, IntegrationStatus, PropertyStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken, decryptToken } from "@/server/integrations/ga4/security/encryption";
import { generateQueryHash } from "@/server/integrations/ga4/security/queryHash";
import "dotenv/config";

const testDbUrl = process.env.TEST_DATABASE_URL;

describe("Real PostgreSQL Database GA4 Models Integration Tests (analytics_saas_test)", () => {
  let testPrisma: PrismaClient;

  beforeAll(async () => {
    if (!testDbUrl) {
      throw new Error("TEST_DATABASE_URL is not set in environment.");
    }

    const adapter = new PrismaPg({ connectionString: testDbUrl });
    testPrisma = new PrismaClient({ adapter });

    // Clean up test tables in correct dependency order
    await testPrisma.integrationSyncLog.deleteMany();
    await testPrisma.analyticsCache.deleteMany();
    await testPrisma.connectedProperty.deleteMany();
    await testPrisma.integrationAccount.deleteMany();
    await testPrisma.workspaceMember.deleteMany();
    await testPrisma.workspace.deleteMany();
    await testPrisma.user.deleteMany();
  });

  afterAll(async () => {
    if (testPrisma) {
      await testPrisma.$disconnect();
    }
  });

  it("should create a workspace and an integration account with encrypted tokens", async () => {
    const user = await testPrisma.user.create({
      data: {
        name: "GA4 DB Tester",
        email: "ga4.tester@analytics-test.local",
      },
    });

    const workspace = await testPrisma.workspace.create({
      data: {
        name: "GA4 Test Agency",
        slug: "ga4-test-agency-slug",
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    const rawAccessToken = "ya29.sample_real_db_access_token_12345";
    const rawRefreshToken = "1//04_sample_real_db_refresh_token_67890";

    const encAccess = encryptToken(rawAccessToken);
    const encRefresh = encryptToken(rawRefreshToken);

    const integrationAccount = await testPrisma.integrationAccount.create({
      data: {
        workspaceId: workspace.id,
        provider: "google",
        providerAccountId: "google_sub_10987654321",
        email: "marketing.lead@gmail.com",
        encryptedAccessToken: encAccess.ciphertext,
        accessTokenIv: encAccess.iv,
        accessTokenTag: encAccess.tag,
        encryptedRefreshToken: encRefresh.ciphertext,
        refreshTokenIv: encRefresh.iv,
        refreshTokenTag: encRefresh.tag,
        keyVersion: 1,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        status: IntegrationStatus.ACTIVE,
      },
    });

    expect(integrationAccount.id).toBeDefined();
    expect(integrationAccount.encryptedAccessToken).toBe(encAccess.ciphertext);
    expect(integrationAccount.encryptedAccessToken).not.toBe(rawAccessToken);

    // Verify decryption matches original raw tokens
    const decryptedAccess = decryptToken({
      ciphertext: integrationAccount.encryptedAccessToken!,
      iv: integrationAccount.accessTokenIv!,
      tag: integrationAccount.accessTokenTag!,
      keyVersion: integrationAccount.keyVersion,
    });
    expect(decryptedAccess).toBe(rawAccessToken);

    const decryptedRefresh = decryptToken({
      ciphertext: integrationAccount.encryptedRefreshToken!,
      iv: integrationAccount.refreshTokenIv!,
      tag: integrationAccount.refreshTokenTag!,
      keyVersion: integrationAccount.keyVersion,
    });
    expect(decryptedRefresh).toBe(rawRefreshToken);
  });

  it("should link multiple GA4 properties to a workspace under an integration account", async () => {
    const workspace = await testPrisma.workspace.findUniqueOrThrow({
      where: { slug: "ga4-test-agency-slug" },
    });
    const integrationAccount = await testPrisma.integrationAccount.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    });

    const prop1 = await testPrisma.connectedProperty.create({
      data: {
        workspaceId: workspace.id,
        integrationAccountId: integrationAccount.id,
        propertyId: "301002001",
        displayName: "E-Commerce Main Store",
        currencyCode: "USD",
        timeZone: "America/New_York",
        isDefault: true,
        status: PropertyStatus.ACTIVE,
      },
    });

    const prop2 = await testPrisma.connectedProperty.create({
      data: {
        workspaceId: workspace.id,
        integrationAccountId: integrationAccount.id,
        propertyId: "301002002",
        displayName: "Corporate Blog",
        currencyCode: "EUR",
        timeZone: "Europe/London",
        isDefault: false,
        status: PropertyStatus.ACTIVE,
      },
    });

    expect(prop1.id).toBeDefined();
    expect(prop2.id).toBeDefined();

    const properties = await testPrisma.connectedProperty.findMany({
      where: { workspaceId: workspace.id },
    });
    expect(properties).toHaveLength(2);
  });

  it("should enforce unique constraint [workspaceId, propertyId] at PostgreSQL engine level", async () => {
    const workspace = await testPrisma.workspace.findUniqueOrThrow({
      where: { slug: "ga4-test-agency-slug" },
    });
    const integrationAccount = await testPrisma.integrationAccount.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    });

    // Attempting to insert a duplicate propertyId in the same workspace should fail
    await expect(
      testPrisma.connectedProperty.create({
        data: {
          workspaceId: workspace.id,
          integrationAccountId: integrationAccount.id,
          propertyId: "301002001", // Duplicate
          displayName: "Duplicate Property",
        },
      })
    ).rejects.toThrow();
  });

  it("should store and retrieve reports from AnalyticsCache using stable queryHash", async () => {
    const workspace = await testPrisma.workspace.findUniqueOrThrow({
      where: { slug: "ga4-test-agency-slug" },
    });
    const prop = await testPrisma.connectedProperty.findFirstOrThrow({
      where: { workspaceId: workspace.id, propertyId: "301002001" },
    });

    const reportParams = { propertyId: "301002001", type: "overview", dateRange: "30d" };
    const queryHash = generateQueryHash(reportParams);

    const mockReportData = {
      summary: {
        activeUsers: 1420,
        sessions: 2105,
        screenPageViews: 8430,
        bounceRate: 38.2,
      },
    };

    const cacheEntry = await testPrisma.analyticsCache.create({
      data: {
        workspaceId: workspace.id,
        connectedPropertyId: prop.id,
        reportType: "overview",
        queryHash,
        dateRange: "30d",
        parameters: reportParams,
        data: mockReportData,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    expect(cacheEntry.id).toBeDefined();

    const retrieved = await testPrisma.analyticsCache.findUnique({
      where: {
        connectedPropertyId_reportType_queryHash: {
          connectedPropertyId: prop.id,
          reportType: "overview",
          queryHash,
        },
      },
    });

    expect(retrieved).not.toBeNull();
    expect((retrieved?.data as any).summary.activeUsers).toBe(1420);
  });

  it("should record sync audit logs in IntegrationSyncLog", async () => {
    const workspace = await testPrisma.workspace.findUniqueOrThrow({
      where: { slug: "ga4-test-agency-slug" },
    });

    const log = await testPrisma.integrationSyncLog.create({
      data: {
        workspaceId: workspace.id,
        propertyId: "301002001",
        endpoint: "overview",
        status: "SUCCESS",
        durationMs: 412,
      },
    });

    expect(log.id).toBeDefined();
    expect(log.status).toBe("SUCCESS");
  });

  it("should cascade delete all integration accounts, properties, and caches when workspace is deleted", async () => {
    const workspace = await testPrisma.workspace.findUniqueOrThrow({
      where: { slug: "ga4-test-agency-slug" },
    });

    await testPrisma.workspace.delete({
      where: { id: workspace.id },
    });

    const accountsCount = await testPrisma.integrationAccount.count({
      where: { workspaceId: workspace.id },
    });
    const propertiesCount = await testPrisma.connectedProperty.count({
      where: { workspaceId: workspace.id },
    });
    const cacheCount = await testPrisma.analyticsCache.count({
      where: { workspaceId: workspace.id },
    });
    const logsCount = await testPrisma.integrationSyncLog.count({
      where: { workspaceId: workspace.id },
    });

    expect(accountsCount).toBe(0);
    expect(propertiesCount).toBe(0);
    expect(cacheCount).toBe(0);
    expect(logsCount).toBe(0);
  });
});
