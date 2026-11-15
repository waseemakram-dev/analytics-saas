import { getAuthenticatedUser } from "@/server/security/guards";
import { getUserWorkspaces } from "@/server/auth/services/profileService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

// GET /api/workspaces/me - Retrieve current user's workspaces and membership
export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    const workspaces = await getUserWorkspaces(authUser.userId);
    return jsonResponse(workspaces, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
