import { describe, expect, it } from "vitest";

import { centerProfileSchema, galleryImageSchema } from "../profile.schemas";
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
