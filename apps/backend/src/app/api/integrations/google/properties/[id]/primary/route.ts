import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace, requireWorkspaceAccess } from "@/server/security/guards";
import { propertyRepository } from "@/server/integrations/ga4/repositories/propertyRepository";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);
    const { id } = await params;

    // Setting primary property requires ADMIN or OWNER role
    await requireWorkspaceAccess(user.userId, membership.workspaceId, "ADMIN");

    const updated = await propertyRepository.setDefaultProperty(membership.workspaceId, id);

    return jsonResponse({
      isDefault: true,
      property: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
