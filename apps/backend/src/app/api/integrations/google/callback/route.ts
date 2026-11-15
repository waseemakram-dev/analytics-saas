import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/server/integrations/ga4/oauth/stateManager";
import { exchangeCodeForTokens } from "@/server/integrations/ga4/oauth/googleOAuthClient";
import { integrationRepository } from "@/server/integrations/ga4/repositories/integrationRepository";
import { oauthCallbackQuerySchema } from "@/server/integrations/ga4/validators/ga4Schemas";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get("format");
    const parsed = oauthCallbackQuerySchema.parse({
      code: searchParams.get("code") || undefined,
      state: searchParams.get("state") || undefined,
      error: searchParams.get("error") || undefined,
      error_description: searchParams.get("error_description") || undefined,
    });

    const frontendBase = process.env.APP_URL || "http://localhost:3000";

    // Handle Google OAuth authorization rejection
    if (parsed.error) {
      const errorMsg = parsed.error_description || parsed.error;
      if (format === "json") {
        return NextResponse.json(
          { success: false, error: { code: "OAUTH_DENIED", message: errorMsg } },
          { status: 400 }
        );
      }
      return NextResponse.redirect(
        `${frontendBase}/account?integration_error=${encodeURIComponent(errorMsg)}`
      );
    }

    if (!parsed.code || !parsed.state) {
      if (format === "json") {
        return NextResponse.json(
          { success: false, error: { code: "MISSING_PARAMS", message: "Missing code or state" } },
          { status: 400 }
        );
      }
      return NextResponse.redirect(
        `${frontendBase}/account?integration_error=missing_oauth_parameters`
      );
    }

    // 1. Verify CSRF state token
    const statePayload = verifyOAuthState(parsed.state);

    // 2. Exchange code for access & refresh tokens and retrieve Google user info
    const { tokens, userInfo } = await exchangeCodeForTokens(parsed.code);

    // 3. Persist IntegrationAccount with encrypted tokens
    const account = await integrationRepository.upsertIntegrationAccount({
      workspaceId: statePayload.workspaceId,
      userInfo,
      tokens,
    });

    if (format === "json") {
      return jsonResponse({
        connected: true,
        integrationAccountId: account.id,
        email: account.email,
        workspaceId: account.workspaceId,
      });
    }

    return NextResponse.redirect(
      `${frontendBase}/account?integration_success=google_analytics&account_id=${account.id}`
    );
  } catch (error: any) {
    console.error("[GA4 OAUTH CALLBACK ERROR]", error);
    const frontendBase = process.env.APP_URL || "http://localhost:3000";
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.get("format") === "json") {
      return handleApiError(error);
    }
    return NextResponse.redirect(
      `${frontendBase}/account?integration_error=${encodeURIComponent(error.message || "OAuth exchange failed")}`
    );
  }
}
