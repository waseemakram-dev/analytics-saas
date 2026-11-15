import { NextRequest } from "next/server";
import { getAuthenticatedUser, getUserActiveWorkspace, requirePropertyAccess } from "@/server/security/guards";
import { ga4DataService } from "@/server/integrations/ga4/services/ga4DataService";
import { analyticsQuerySchema } from "@/server/integrations/ga4/validators/ga4Schemas";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const membership = await getUserActiveWorkspace(user.userId);

    const searchParams = req.nextUrl.searchParams;
    const parsed = analyticsQuerySchema.parse({
      propertyId: searchParams.get("propertyId") || undefined,
      refresh: searchParams.get("refresh") || undefined,
    });

    const property = await requirePropertyAccess(membership.workspaceId, parsed.propertyId);

    const report = await ga4DataService.getRealtime({
      workspaceId: membership.workspaceId,
      propertyId: property.id,
      refresh: parsed.refresh,
    });

    return jsonResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
