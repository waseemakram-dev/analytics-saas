import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace } from "@/server/security/guards";
import { generateOAuthState } from "@/server/integrations/ga4/oauth/stateManager";
import { getAuthorizationUrl } from "@/server/integrations/ga4/oauth/googleOAuthClient";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);

    const searchParams = req.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspaceId") || membership.workspaceId;

    const state = generateOAuthState(workspaceId, user.userId);
    const authorizationUrl = getAuthorizationUrl(state);

    return jsonResponse({
      authorizationUrl,
      workspaceId,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    return handleApiError(error);
  }
}
