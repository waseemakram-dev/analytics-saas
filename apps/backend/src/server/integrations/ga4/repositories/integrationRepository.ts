import { prisma } from "@/server/database/prisma";
import { encryptToken, decryptToken } from "../security/encryption";
import {
  refreshAccessToken,
  revokeToken,
} from "../oauth/googleOAuthClient";
import { GoogleOAuthTokens, GoogleUserInfo } from "../types/ga4.types";
import { IntegrationStatus } from "@prisma/client";

export class IntegrationRepository {
  /**
   * Persists or updates an IntegrationAccount with securely encrypted tokens.
   * If Google does not return a new refresh token on reconnect, preserves the existing one.
   */
  async upsertIntegrationAccount(params: {
    workspaceId: string;
    userInfo: GoogleUserInfo;
    tokens: GoogleOAuthTokens;
  }) {
    const { workspaceId, userInfo, tokens } = params;

    // Check for existing record to preserve refresh token if Google omitted it
    const existing = await prisma.integrationAccount.findUnique({
      where: {
        workspaceId_provider_providerAccountId: {
          workspaceId,
          provider: "google",
          providerAccountId: userInfo.id,
        },
      },
    });

    let encAccess = tokens.accessToken ? encryptToken(tokens.accessToken) : null;
    let encRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    // Preserve existing refresh token if not returned on this authorization cycle
    const refreshTokenData = encRefresh
      ? {
          encryptedRefreshToken: encRefresh.ciphertext,
          refreshTokenIv: encRefresh.iv,
          refreshTokenTag: encRefresh.tag,
        }
      : existing?.encryptedRefreshToken
      ? {
          encryptedRefreshToken: existing.encryptedRefreshToken,
          refreshTokenIv: existing.refreshTokenIv,
          refreshTokenTag: existing.refreshTokenTag,
        }
      : {};

    const account = await prisma.integrationAccount.upsert({
      where: {
        workspaceId_provider_providerAccountId: {
          workspaceId,
          provider: "google",
          providerAccountId: userInfo.id,
        },
      },
      create: {
        workspaceId,
        provider: "google",
        providerAccountId: userInfo.id,
        email: userInfo.email,
        encryptedAccessToken: encAccess?.ciphertext || null,
        accessTokenIv: encAccess?.iv || null,
        accessTokenTag: encAccess?.tag || null,
        keyVersion: encAccess?.keyVersion || 1,
        ...refreshTokenData,
        expiresAt: tokens.expiresAt || null,
        scope: tokens.scope || null,
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
      update: {
        email: userInfo.email,
        encryptedAccessToken: encAccess?.ciphertext || undefined,
        accessTokenIv: encAccess?.iv || undefined,
        accessTokenTag: encAccess?.tag || undefined,
        keyVersion: encAccess?.keyVersion || undefined,
        ...refreshTokenData,
        expiresAt: tokens.expiresAt || undefined,
        scope: tokens.scope || undefined,
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
    });

    return account;
  }

  /**
   * Retrieves an integration account with decrypted tokens.
   */
  async getIntegrationAccountWithTokens(id: string) {
    const account = await prisma.integrationAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return null;
    }

    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (account.encryptedAccessToken && account.accessTokenIv && account.accessTokenTag) {
      accessToken = decryptToken({
        ciphertext: account.encryptedAccessToken,
        iv: account.accessTokenIv,
        tag: account.accessTokenTag,
        keyVersion: account.keyVersion,
      });
    }

    if (account.encryptedRefreshToken && account.refreshTokenIv && account.refreshTokenTag) {
      refreshToken = decryptToken({
        ciphertext: account.encryptedRefreshToken,
        iv: account.refreshTokenIv,
        tag: account.refreshTokenTag,
        keyVersion: account.keyVersion,
      });
    }

    return {
      ...account,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Ensures the integration account has an active, non-expired access token.
   * Automatically refreshes and re-encrypts if within 5 minutes of expiration.
   */
  async getValidTokens(integrationAccountId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    const account = await this.getIntegrationAccountWithTokens(integrationAccountId);

    if (!account) {
      throw new Error(`Integration account ${integrationAccountId} not found.`);
    }

    if (account.status === IntegrationStatus.REVOKED) {
      throw new Error("This Google integration account was revoked. Please reconnect.");
    }

    const fiveMinutes = 5 * 60 * 1000;
    const isExpired =
      !account.expiresAt ||
      account.expiresAt.getTime() - Date.now() < fiveMinutes;

    if (!isExpired && account.accessToken) {
      return {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken || undefined,
      };
    }

    // Refresh token is required to refresh access
    if (!account.refreshToken) {
      await prisma.integrationAccount.update({
        where: { id: integrationAccountId },
        data: {
          status: IntegrationStatus.EXPIRED,
          lastError: "Access token expired and no refresh token is stored. Re-authorization required.",
        },
      });
      throw new Error("Google access token expired and no refresh token is available. Please reconnect.");
    }

    try {
      const refreshed = await refreshAccessToken(account.refreshToken);

      const encAccess = encryptToken(refreshed.accessToken);
      const encRefresh = refreshed.newRefreshToken
        ? encryptToken(refreshed.newRefreshToken)
        : null;

      await prisma.integrationAccount.update({
        where: { id: integrationAccountId },
        data: {
          encryptedAccessToken: encAccess.ciphertext,
          accessTokenIv: encAccess.iv,
          accessTokenTag: encAccess.tag,
          keyVersion: encAccess.keyVersion,
          ...(encRefresh && {
            encryptedRefreshToken: encRefresh.ciphertext,
            refreshTokenIv: encRefresh.iv,
            refreshTokenTag: encRefresh.tag,
          }),
          expiresAt: refreshed.expiresAt,
          status: IntegrationStatus.ACTIVE,
          lastError: null,
        },
      });

      return {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.newRefreshToken || account.refreshToken,
      };
    } catch (err: any) {
      const isInvalidGrant =
        err.message?.includes("invalid_grant") || err.code === 400;

      await prisma.integrationAccount.update({
        where: { id: integrationAccountId },
        data: {
          status: isInvalidGrant ? IntegrationStatus.REVOKED : IntegrationStatus.ERROR,
          lastError: err.message || "Failed to refresh Google token.",
        },
      });

      throw new Error(
        `Failed to refresh Google integration token: ${err.message || "Unknown error"}`
      );
    }
  }

  /**
   * Lists all connected Google accounts for a workspace (sanitized, tokens omitted).
   */
  async listWorkspaceAccounts(workspaceId: string) {
    const accounts = await prisma.integrationAccount.findMany({
      where: { workspaceId, provider: "google" },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        providerAccountId: true,
        email: true,
        status: true,
        expiresAt: true,
        scope: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { properties: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return accounts;
  }

  /**
   * Disconnects an integration account, revoking tokens with Google and removing from database.
   */
  async disconnectAccount(workspaceId: string, integrationAccountId: string) {
    const account = await this.getIntegrationAccountWithTokens(integrationAccountId);

    if (!account || account.workspaceId !== workspaceId) {
      throw new Error("Integration account not found in this workspace.");
    }

    // Attempt revocation with Google
    if (account.refreshToken) {
      await revokeToken(account.refreshToken);
    } else if (account.accessToken) {
      await revokeToken(account.accessToken);
    }

    // Cascade delete connected properties, caches, and integration record
    await prisma.integrationAccount.delete({
      where: { id: integrationAccountId },
    });

    return { success: true };
  }
}

export const integrationRepository = new IntegrationRepository();
