import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace } from "@/server/security/guards";
import { integrationRepository } from "@/server/integrations/ga4/repositories/integrationRepository";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);

    const searchParams = req.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspaceId") || membership.workspaceId;

    const accounts = await integrationRepository.listWorkspaceAccounts(workspaceId);

    return jsonResponse({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}
