import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/server/security/guards";
import { changeUserPassword } from "@/server/auth/services/profileService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

// POST /api/users/me/password - Change authenticated user password
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const body = await req.json();
    const result = await changeUserPassword(authUser.userId, body);
    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
