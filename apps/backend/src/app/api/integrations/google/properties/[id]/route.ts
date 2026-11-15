import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace, requireWorkspaceAccess } from "@/server/security/guards";
import { propertyRepository } from "@/server/integrations/ga4/repositories/propertyRepository";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);
    const { id } = await params;

    // Unlinking properties requires ADMIN or OWNER role
    await requireWorkspaceAccess(user.userId, membership.workspaceId, "ADMIN");

    const result = await propertyRepository.unlinkProperty(membership.workspaceId, id);

    return jsonResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
