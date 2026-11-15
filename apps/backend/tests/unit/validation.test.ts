import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/server/auth/validators/authSchemas";

describe("Authentication Input Validation Schemas", () => {
  describe("Registration Schema", () => {
    it("should accept valid registration input", () => {
      const valid = {
        name: "Jane Doe",
        email: "Jane.Doe@Example.COM",
        password: "ValidPassword123!",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("jane.doe@example.com"); // Normalized lowercase
      }
    });

    it("should reject passwords shorter than 8 characters", () => {
      const invalid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "Sh1!",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject passwords without an uppercase letter", () => {
      const invalid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "lowercase123!@#",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject passwords without a number", () => {
      const invalid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "NoNumbersInThis!@",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject passwords without a special character", () => {
      const invalid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "NoSpecialCharacters123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject malformed email addresses", () => {
      const invalid = {
        name: "Jane Doe",
        email: "not-an-email",
        password: "ValidPassword123!",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Login Schema", () => {
    it("should accept valid credentials format", () => {
      const valid = {
        email: "user@domain.com",
        password: "any_password_string",
      };
      expect(loginSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject empty password", () => {
      const invalid = {
        email: "user@domain.com",
        password: "",
      };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("Password Reset & Change Schemas", () => {
    it("should enforce strong password rules on password reset", () => {
      const valid = {
        email: "user@domain.com",
        token: "a".repeat(32),
        newPassword: "BrandNewPassword2026$",
      };
      expect(resetPasswordSchema.safeParse(valid).success).toBe(true);

      const weak = {
        ...valid,
        newPassword: "weak",
      };
      expect(resetPasswordSchema.safeParse(weak).success).toBe(false);
    });

    it("should enforce strong password rules on password change", () => {
      const valid = {
        currentPassword: "OldPassword1!",
        newPassword: "BrandNewPassword2026$",
      };
      expect(changePasswordSchema.safeParse(valid).success).toBe(true);
    });
  });
});
