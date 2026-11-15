import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace, requireWorkspaceAccess } from "@/server/security/guards";
import { integrationRepository } from "@/server/integrations/ga4/repositories/integrationRepository";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);
    const { id } = await params;

    // Disconnecting integrations requires ADMIN or OWNER role
    await requireWorkspaceAccess(user.userId, membership.workspaceId, "ADMIN");

    await integrationRepository.disconnectAccount(membership.workspaceId, id);

    return jsonResponse({
      disconnected: true,
      integrationAccountId: id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
