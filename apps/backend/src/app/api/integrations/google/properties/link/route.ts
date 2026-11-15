import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace, requireWorkspaceAccess } from "@/server/security/guards";
import { propertyRepository } from "@/server/integrations/ga4/repositories/propertyRepository";
import { linkPropertySchema } from "@/server/integrations/ga4/validators/ga4Schemas";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);

    // Linking properties requires ADMIN or OWNER role
    await requireWorkspaceAccess(user.userId, membership.workspaceId, "ADMIN");

    const body = await req.json();
    const validated = linkPropertySchema.parse(body);

    const property = await propertyRepository.linkProperty({
      workspaceId: membership.workspaceId,
      integrationAccountId: validated.integrationAccountId,
      propertyMetadata: {
        name: `properties/${validated.propertyId}`,
        propertyId: validated.propertyId,
        displayName: validated.displayName || `GA4 Property ${validated.propertyId}`,
        parentAccount: validated.parentAccount,
        currencyCode: validated.currencyCode || "USD",
        timeZone: validated.timeZone || "UTC",
      },
      isDefault: validated.isDefault,
    });

    return jsonResponse({
      linked: true,
      property,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
