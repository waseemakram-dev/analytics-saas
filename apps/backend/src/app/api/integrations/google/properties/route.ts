import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace } from "@/server/security/guards";
import { propertyRepository } from "@/server/integrations/ga4/repositories/propertyRepository";
import { integrationRepository } from "@/server/integrations/ga4/repositories/integrationRepository";
import { ga4AdminService } from "@/server/integrations/ga4/services/ga4AdminService";
import { createAuthenticatedClient } from "@/server/integrations/ga4/oauth/googleOAuthClient";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);

    const searchParams = req.nextUrl.searchParams;
    const integrationAccountId = searchParams.get("integrationAccountId");
    const accountFilter = searchParams.get("accountFilter") || undefined;

    // Mode 1: Discover available properties directly from Google Cloud via Admin API
    if (integrationAccountId) {
      const tokens = await integrationRepository.getValidTokens(integrationAccountId);
      const auth = createAuthenticatedClient(tokens);
      const availableProperties = await ga4AdminService.listProperties(auth, accountFilter);

      // Fetch already linked properties to tag them
      const linkedProperties = await propertyRepository.listProperties(membership.workspaceId);
      const linkedMap = new Set(linkedProperties.map((p) => p.propertyId));

      const properties = availableProperties.map((p) => ({
        ...p,
        isLinked: linkedMap.has(p.propertyId),
      }));

      return jsonResponse({
        integrationAccountId,
        properties,
      });
    }

    // Mode 2: List already linked properties in the workspace
    const properties = await propertyRepository.listProperties(membership.workspaceId);

    return jsonResponse({ properties });
  } catch (error) {
    return handleApiError(error);
  }
}
