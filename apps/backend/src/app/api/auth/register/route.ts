import { NextRequest } from "next/server";
import { registerUser } from "@/server/auth/services/registrationService";
import { handleApiError, jsonResponse } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await registerUser(body);
    return jsonResponse(
      {
        message: "Registration successful. Please check your email to verify your account.",
        user,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
