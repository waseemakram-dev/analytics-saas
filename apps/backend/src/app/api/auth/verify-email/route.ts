import { NextRequest } from "next/server";
import { verifyEmail, resendVerificationEmail } from "@/server/auth/services/verificationService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

// POST: Verify email with token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await verifyEmail(body);
    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT: Resend verification email
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await resendVerificationEmail(body.email);
    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
