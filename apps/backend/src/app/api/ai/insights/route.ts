import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  getUserActiveWorkspace,
  requirePropertyAccess,
} from "@/server/security/guards";
import { AiQuotaManager } from "@/server/ai/security/aiQuotaManager";
import { generateInsightsInputSchema } from "@/server/ai/validators/insightsSchemas";
import { aiInsightsService } from "@/server/ai/services/aiInsightsService";
import { jsonResponse, handleApiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate session
    const authUser = await getAuthenticatedUser();

    // 2. Derive active workspace from verified membership
    const membership = await getUserActiveWorkspace(authUser.userId);

    // 3. Workspace-scoped rate limit (Layer A usage limit)
    AiQuotaManager.checkWorkspaceLimit(membership.workspaceId);

    // 4. Validate input payload
    const body = await req.json().catch(() => ({}));
    const parsed = generateInsightsInputSchema.parse(body);

    // 5. Verify property access in active workspace
    const property = await requirePropertyAccess(membership.workspaceId, parsed.propertyId);

    // 6. Generate grounded AI insights
    const result = await aiInsightsService.generateInsights({
      workspaceId: membership.workspaceId,
      userId: authUser.userId,
      propertyId: property.id,
      dateRange: parsed.dateRange,
      language: parsed.language,
      focus: parsed.focus,
      refresh: parsed.refresh,
    });

    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
