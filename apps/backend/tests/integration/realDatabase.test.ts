import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/server/auth/utils/password";
import { generateSecureToken, hashToken, createExpiryDate } from "@/server/auth/utils/tokens";
import "dotenv/config";

const testDbUrl = process.env.TEST_DATABASE_URL;

describe("Real PostgreSQL Database Integration Tests (analytics_saas_test)", () => {
  let testPrisma: PrismaClient;

  beforeAll(async () => {
    if (!testDbUrl) {
      throw new Error("TEST_DATABASE_URL is not set in environment.");
    }

    const adapter = new PrismaPg({ connectionString: testDbUrl });
    testPrisma = new PrismaClient({ adapter });

    // Clean up test data before running
    await testPrisma.verificationToken.deleteMany();
    await testPrisma.passwordResetToken.deleteMany();
    await testPrisma.workspaceMember.deleteMany();
    await testPrisma.workspace.deleteMany();
    await testPrisma.session.deleteMany();
    await testPrisma.account.deleteMany();
    await testPrisma.user.deleteMany();
  });

  afterAll(async () => {
    if (testPrisma) {
      await testPrisma.$disconnect();
    }
  });

  it("should successfully connect to the real PostgreSQL test database", async () => {
    const result = await testPrisma.$queryRaw<Array<{ connected: number }>>`SELECT 1 as connected`;
    expect(result).toBeDefined();
    expect(result[0].connected).toBe(1);
  });

  it("should create a real user, workspace, and membership in an atomic transaction", async () => {
    const email = "real.user@analytics-test.local";
    const passwordHash = await hashPassword("RealSecurePass123!@#");
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    const txResult = await testPrisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: "Real Database User",
          email,
          passwordHash,
          role: "USER",
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: "Real Database User's Workspace",
          slug: `real-workspace-${Date.now().toString(36)}`,
        },
      });

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      const token = await tx.verificationToken.create({
        data: {
          identifier: email,
          token: tokenHash,
          expires: createExpiryDate(24 * 60),
        },
      });

      return { user, workspace, member, token };
    });

    expect(txResult.user.id).toBeDefined();
    expect(txResult.user.email).toBe(email);
    expect(txResult.workspace.id).toBeDefined();
    expect(txResult.member.role).toBe("OWNER");
    expect(txResult.token.token).toBe(tokenHash);

    // Verify row was actually committed to PostgreSQL
    const savedUser = await testPrisma.user.findUnique({
      where: { email },
      include: {
        workspaceMembers: {
          include: { workspace: true },
        },
      },
    });

    expect(savedUser).not.toBeNull();
    expect(savedUser?.name).toBe("Real Database User");
    expect(savedUser?.workspaceMembers).toHaveLength(1);
    expect(savedUser?.workspaceMembers[0].workspace.id).toBe(txResult.workspace.id);
  });

  it("should enforce unique constraint on user email at PostgreSQL engine level", async () => {
    const email = "duplicate.check@analytics-test.local";
    const passwordHash = await hashPassword("Password123!");

    // Create first user
    await testPrisma.user.create({
      data: {
        name: "First User",
        email,
        passwordHash,
      },
    });

    // Attempt to create second user with duplicate email
    await expect(
      testPrisma.user.create({
        data: {
          name: "Second User",
          email,
          passwordHash,
        },
      })
    ).rejects.toThrow();
  });

  it("should rollback transaction completely if an operation fails", async () => {
    const rollbackEmail = "rollback.test@analytics-test.local";

    try {
      await testPrisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            name: "Rollback User",
            email: rollbackEmail,
          },
        });

        // Deliberately throw an error inside transaction
        throw new Error("Simulated transactional failure");
      });
    } catch {
      // Expected failure
    }

    // Verify that User was rolled back and does not exist in PostgreSQL
    const userInDb = await testPrisma.user.findUnique({
      where: { email: rollbackEmail },
    });
    expect(userInDb).toBeNull();
  });

  it("should persist and query password reset tokens by SHA-256 hash", async () => {
    const email = "reset.token@analytics-test.local";
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = createExpiryDate(60);

    const tokenRecord = await testPrisma.passwordResetToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    });

    expect(tokenRecord.id).toBeDefined();

    // Query token back by unique hash
    const found = await testPrisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
  });
});
