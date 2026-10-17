import { describe, expect, it } from "vitest";

import { centerProfileSchema, galleryImageSchema, toCenterUpdatePayload } from "../profile.schemas";
import type { CenterProfileFormValues } from "../profile.schemas";

const VALID_CENTER: CenterProfileFormValues = {
  nameI18n: { es: "Studio Yotuvia", en: "" },
  address: "Calle 123",
  email: "hola@studio.com",
  phone: "5551234",
  url: "",
  descriptionI18n: { es: "", en: "" },
  currency: "USD",
  latitude: "",
  longitude: "",
  password: "",
  depositRequired: false,
  depositAmount: "",
  depositPercent: "",
  depositTrustThreshold: "",
  depositHoldMinutes: "",
  depositQrUrl: "",
  schedules: [],
};

describe("galleryImageSchema", () => {
  it("accepts absolute and root-relative upload paths", () => {
    for (const imageUrl of ["https://cdn.test/a.png", "http://cdn.test/a.png", "/uploads/abc123.jpg"]) {
      expect(galleryImageSchema.safeParse({ imageUrl, isCover: false, isProfile: false }).success).toBe(
        true,
      );
    }
  });

  it("rejects empty, spaced and non-http(s) values", () => {
    for (const imageUrl of ["", "not a url", "javascript:alert(1)", "ftp://x.test/a.png", "/up loads/a.png"]) {
      const result = galleryImageSchema.safeParse({ imageUrl, isCover: false, isProfile: false });
      expect(result.success).toBe(false);
    }
  });
});

describe("centerProfileSchema depositQrUrl", () => {
  it("accepts empty, absolute and root-relative upload paths", () => {
    for (const depositQrUrl of ["", "https://cdn.test/qr.png", "/uploads/qr-1.png"]) {
      expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositQrUrl }).success).toBe(true);
    }
  });

  it("rejects spaced and non-http(s) values", () => {
    for (const depositQrUrl of ["not a url", "javascript:alert(1)", "ftp://x.test/qr.png"]) {
      const result = centerProfileSchema.safeParse({ ...VALID_CENTER, depositQrUrl });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => String(issue.path[0]))).toContain("depositQrUrl");
      }
    }
  });
});

describe("centerProfileSchema money, percentages and coordinates", () => {
  it("reads a deposit amount the way the viewer typed it", () => {
    expect(
      centerProfileSchema.safeParse({ ...VALID_CENTER, depositAmount: "1.234,56" }).success,
    ).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositAmount: "" }).success).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositAmount: "-1" }).success).toBe(false);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositAmount: "1.2345" }).success).toBe(false);
  });

  it("sends the PARSED amount, not a truncated one", () => {
    // Validating with the shared rule and converting with `Number` would give 1.234.
    expect(
      toCenterUpdatePayload({ ...VALID_CENTER, depositAmount: "1.234,56" }).depositAmount,
    ).toBe(1234.56);
    expect(
      toCenterUpdatePayload({ ...VALID_CENTER, depositAmount: "1,234.56" }).depositAmount,
    ).toBe(1234.56);
  });

  it("keeps a deposit PERCENT canonical and capped at 100", () => {
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositPercent: "100" }).success).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositPercent: "101" }).success).toBe(false);
    // A percentage is not money: `1.234` cannot read as 1234, so it stays invalid.
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, depositPercent: "1.234" }).success).toBe(false);
  });

  it("accepts a coordinate and refuses a pasted exponent or a value off the globe", () => {
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, latitude: "-16.5" }).success).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, latitude: "90" }).success).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, latitude: "90.1" }).success).toBe(false);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, latitude: "1e5" }).success).toBe(false);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, longitude: "-180" }).success).toBe(true);
    expect(centerProfileSchema.safeParse({ ...VALID_CENTER, longitude: "-180.1" }).success).toBe(false);
  });
});
