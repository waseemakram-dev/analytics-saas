import { NextRequest } from "next/server";
import { resetPassword } from "@/server/auth/services/passwordResetService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await resetPassword(body);
    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
