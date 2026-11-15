import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/server/security/guards";
import { getUserProfile, updateUserProfile } from "@/server/auth/services/profileService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

// GET /api/users/me - Retrieve current user profile
export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    const profile = await getUserProfile(authUser.userId);
    return jsonResponse(profile, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/users/me - Update permitted profile fields
export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const body = await req.json();
    const updated = await updateUserProfile(authUser.userId, body);
    return jsonResponse(updated, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
