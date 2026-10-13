import { describe, expect, it } from "vitest";

import { ROUTES, joinInvitationPath } from "@/presentation/lib/routes";

import {
  acceptInvitationSchema,
  createPersonnelSchema,
  EMPTY_JOIN_FORM,
  invitationSchema,
  personnelToFormValues,
  toAcceptInvitationData,
  toCreatePersonnelData,
  toUpdatePersonnelData,
  updatePersonnelSchema,
} from "../personnel.schemas";
import type { AcceptInvitationFormValues, PersonnelFormValues } from "../personnel.schemas";

const VALID: PersonnelFormValues = {
  firstName: "Ana",
  lastName: "Gómez",
  email: "ana@example.com",
  phone: "111",
  password: "supersecret",
};

function issuePaths(result: ReturnType<typeof createPersonnelSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("createPersonnelSchema", () => {
  it("accepts a valid payload", () => {
    expect(createPersonnelSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires first name, last name, email and phone (API: all required)", () => {
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, firstName: " " }))).toContain(
      "firstName",
    );
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, lastName: "" }))).toContain(
      "lastName",
    );
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, phone: "" }))).toContain("phone");
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, email: "nope" }))).toContain(
      "email",
    );
  });

  it("requires a password of 8 to 255 characters", () => {
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, password: "" }))).toContain(
      "password",
    );
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, password: "short" }))).toContain(
      "password",
    );
    expect(createPersonnelSchema.safeParse({ ...VALID, password: "a".repeat(256) }).success).toBe(
      false,
    );
  });

  it("caps the API field lengths", () => {
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, email: `${"a".repeat(70)}@x.com` }))).toContain(
      "email",
    );
    expect(issuePaths(createPersonnelSchema.safeParse({ ...VALID, phone: "9".repeat(21) }))).toContain(
      "phone",
    );
  });
});

describe("updatePersonnelSchema", () => {
  it("accepts an empty password: the update contract carries no password", () => {
    expect(updatePersonnelSchema.safeParse({ ...VALID, password: "" }).success).toBe(true);
  });

  it("still validates the identity fields", () => {
    expect(updatePersonnelSchema.safeParse({ ...VALID, email: "nope" }).success).toBe(false);
  });
});

describe("personnel payload mappers", () => {
  it("maps create values onto CreatePersonnelData", () => {
    expect(toCreatePersonnelData(VALID, 7)).toEqual({
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      phone: "111",
      password: "supersecret",
      beautyCenterId: 7,
    });
  });

  it("never sends a password on update", () => {
    const payload = toUpdatePersonnelData({ ...VALID, password: "supersecret" });
    expect(payload).not.toHaveProperty("password");
    expect(payload).toEqual({
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      phone: "111",
    });
  });

  it("pre-fills the form from an existing staff member", () => {
    expect(
      personnelToFormValues({
        id: 1,
        beautyCenterId: 7,
        firstName: "Beto",
        lastName: "Ruiz",
        email: "beto@example.com",
        phone: "222",
        isActive: false,
      }),
    ).toEqual({
      firstName: "Beto",
      lastName: "Ruiz",
      email: "beto@example.com",
      phone: "222",
      password: "",
    });
  });
});

describe("invitationSchema", () => {
  it("requires a valid email (API binds required,email)", () => {
    expect(invitationSchema.safeParse({ email: "new@example.com" }).success).toBe(true);
    expect(invitationSchema.safeParse({ email: "" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

const VALID_JOIN: AcceptInvitationFormValues = {
  firstName: "Ana",
  lastName: "Gómez",
  phone: "111",
  password: "supersecret",
  confirmPassword: "supersecret",
};

function joinPaths(result: ReturnType<typeof acceptInvitationSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("acceptInvitationSchema", () => {
  it("accepts a valid acceptance payload", () => {
    expect(acceptInvitationSchema.safeParse(VALID_JOIN).success).toBe(true);
    expect(EMPTY_JOIN_FORM).toEqual({
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      confirmPassword: "",
    });
  });

  it("requires first and last name", () => {
    expect(joinPaths(acceptInvitationSchema.safeParse({ ...VALID_JOIN, firstName: " " }))).toContain(
      "firstName",
    );
    expect(joinPaths(acceptInvitationSchema.safeParse({ ...VALID_JOIN, lastName: "" }))).toContain(
      "lastName",
    );
  });

  it("rejects a password shorter than 8 characters (core/API contract)", () => {
    expect(joinPaths(acceptInvitationSchema.safeParse({ ...VALID_JOIN, password: "short" }))).toContain(
      "password",
    );
  });

  it("rejects a mismatched confirmation before any request", () => {
    expect(
      joinPaths(
        acceptInvitationSchema.safeParse({ ...VALID_JOIN, confirmPassword: "different" }),
      ),
    ).toContain("confirmPassword");
  });

  it("accepts an empty phone and caps it at the API limit", () => {
    expect(acceptInvitationSchema.safeParse({ ...VALID_JOIN, phone: "" }).success).toBe(true);
    expect(
      joinPaths(acceptInvitationSchema.safeParse({ ...VALID_JOIN, phone: "9".repeat(21) })),
    ).toContain("phone");
  });
});

describe("toAcceptInvitationData", () => {
  it("maps the values and the URL token onto AcceptInvitationData", () => {
    expect(toAcceptInvitationData(VALID_JOIN, "tok-1")).toEqual({
      token: "tok-1",
      firstName: "Ana",
      lastName: "Gómez",
      phone: "111",
      password: "supersecret",
    });
  });

  it("trims the optional phone instead of sending whitespace", () => {
    expect(toAcceptInvitationData({ ...VALID_JOIN, phone: " 111 " }, "tok-1").phone).toBe("111");
  });
});

describe("joinInvitationPath", () => {
  it("builds the token URL from the registered route", () => {
    expect(ROUTES.join).toBe("/join/:token");
    expect(joinInvitationPath("abc123")).toBe("/join/abc123");
  });
});
