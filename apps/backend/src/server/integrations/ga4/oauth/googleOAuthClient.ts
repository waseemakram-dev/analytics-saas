import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { GoogleOAuthTokens, GoogleUserInfo } from "../types/ga4.types";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config();

const GA4_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const USERINFO_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GA4_OAUTH_SCOPES = [GA4_READONLY_SCOPE, ...USERINFO_SCOPES];

export function getGoogleOAuthCredentials() {
  const clientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) are missing from backend environment."
    );
  }

  return { clientId, clientSecret };
}

export function getDefaultRedirectUri(): string {
  return (
    process.env.GOOGLE_ANALYTICS_REDIRECT_URI ||
    "http://localhost:3001/api/integrations/google/callback"
  );
}

/**
 * Creates a new Google OAuth2Client instance.
 */
export function createOAuth2Client(redirectUri = getDefaultRedirectUri()): OAuth2Client {
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth authorization URL requesting GA4 read-only access.
 */
export function getAuthorizationUrl(state: string, redirectUri = getDefaultRedirectUri()): string {
  const client = createOAuth2Client(redirectUri);

  return client.generateAuthUrl({
    access_type: "offline", // Essential to obtain refresh_token
    prompt: "consent select_account", // Force consent and account chooser popup
    scope: GA4_OAUTH_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/**
 * Exchanges authorization code for access and refresh tokens, and fetches Google user info.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri = getDefaultRedirectUri()
): Promise<{
  tokens: GoogleOAuthTokens;
  userInfo: GoogleUserInfo;
}> {
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google OAuth did not return an access token.");
  }

  client.setCredentials(tokens);

  // Fetch Google account identity for the connected integration
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: userinfo } = await oauth2.userinfo.get();

  if (!userinfo.id || !userinfo.email) {
    throw new Error("Could not retrieve Google account identity (sub / email).");
  }

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
      scope: tokens.scope || undefined,
      tokenType: tokens.token_type || "Bearer",
    },
    userInfo: {
      id: userinfo.id,
      email: userinfo.email,
      name: userinfo.name || undefined,
      picture: userinfo.picture || undefined,
    },
  };
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  newRefreshToken?: string;
}> {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token.");
  }

  const expiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  return {
    accessToken: credentials.access_token,
    expiresAt,
    newRefreshToken: credentials.refresh_token || undefined,
  };
}

/**
 * Creates an authorized OAuth2Client preloaded with credentials.
 */
export function createAuthenticatedClient(tokens: {
  accessToken: string;
  refreshToken?: string;
}): OAuth2Client {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  return client;
}

/**
 * Revokes access and refresh tokens with Google.
 */
export async function revokeToken(token: string): Promise<void> {
  const client = createOAuth2Client();
  try {
    await client.revokeToken(token);
  } catch (err: any) {
    // If token was already revoked on Google's side, do not fail
    console.warn("Token revocation warning:", err.message);
  }
}
