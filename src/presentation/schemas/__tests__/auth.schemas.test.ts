import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "../auth.schemas";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "supersecret",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "supersecret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "web.forms.validation.email_invalid",
      );
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "web.forms.validation.password_min",
      );
    }
  });

  it("reports the required key for empty input", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.every((issue) => issue.message === "web.forms.validation.required"),
      ).toBe(true);
    }
  });
});

describe("registerSchema", () => {
  const baseClient = {
    role: "CLIENT" as const,
    email: "user@example.com",
    password: "supersecret",
    confirmPassword: "supersecret",
    firstName: "Ana",
    lastName: "Diaz",
    phone: "123456",
    termsAccepted: true,
  };

  it("accepts a complete CLIENT registration", () => {
    expect(registerSchema.safeParse(baseClient).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...baseClient, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "web.forms.validation.password_mismatch",
      );
    }
  });

  it("rejects an unaccepted terms checkbox", () => {
    const result = registerSchema.safeParse({ ...baseClient, termsAccepted: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "web.forms.validation.terms_required",
      );
    }
  });

  it("requires a business name for a BEAUTY_CENTER registration", () => {
    const result = registerSchema.safeParse({
      ...baseClient,
      role: "BEAUTY_CENTER",
      firstName: undefined,
      lastName: undefined,
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("name"))).toBe(true);
    }
  });
});
