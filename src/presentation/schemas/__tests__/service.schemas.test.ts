import { describe, expect, it } from "vitest";

import {
  categoryFormSchema,
  createServiceSchema,
  serviceToFormValues,
  toCreateCategoryData,
  toCreateServiceData,
  toUpdateServiceData,
  updateServiceSchema,
} from "../service.schemas";
import type { ServiceFormValues } from "../service.schemas";

const VALID: ServiceFormValues = {
  nameI18n: { es: "Corte", en: "Haircut" },
  descriptionI18n: { es: "Lavado y corte", en: "Wash and cut" },
  categoryId: "1",
  duration: "45",
  price: "8000",
  imageUrl: "",
  isActive: true,
};

const VALID_CATEGORY = {
  nameI18n: { es: "Cabello", en: "Hair" },
  descriptionI18n: { es: "", en: "" },
};

function issuePaths(result: ReturnType<typeof createServiceSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("createServiceSchema", () => {
  it("accepts a valid multi-language payload", () => {
    expect(createServiceSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires at least one language for the name", () => {
    expect(
      issuePaths(createServiceSchema.safeParse({ ...VALID, nameI18n: { es: "", en: "" } })),
    ).toContain("nameI18n");
    // One language alone is enough.
    expect(createServiceSchema.safeParse({ ...VALID, nameI18n: { es: "", en: "Haircut" } }).success).toBe(true);
    expect(createServiceSchema.safeParse({ ...VALID, nameI18n: { es: "Corte", en: "" } }).success).toBe(true);
  });

  it("mirrors the API name bounds (min=2, max=100) per language", () => {
    expect(issuePaths(createServiceSchema.safeParse({ ...VALID, nameI18n: { es: "A" } }))).toContain(
      "nameI18n",
    );
    expect(
      issuePaths(createServiceSchema.safeParse({ ...VALID, nameI18n: { en: "A".repeat(101) } })),
    ).toContain("nameI18n");
  });

  it("requires a category", () => {
    expect(issuePaths(createServiceSchema.safeParse({ ...VALID, categoryId: "" }))).toContain(
      "categoryId",
    );
  });

  it("requires a whole duration between 1 and 600 minutes", () => {
    for (const duration of ["", "0", "-5", "abc", "601"]) {
      expect(issuePaths(createServiceSchema.safeParse({ ...VALID, duration }))).toContain(
        "duration",
      );
    }
    expect(createServiceSchema.safeParse({ ...VALID, duration: "600" }).success).toBe(true);
  });

  it("requires a non-negative price with at most 2 decimals", () => {
    for (const price of ["", "abc", "-1", "10.555"]) {
      expect(issuePaths(createServiceSchema.safeParse({ ...VALID, price }))).toContain("price");
    }
    expect(createServiceSchema.safeParse({ ...VALID, price: "0" }).success).toBe(true);
    expect(createServiceSchema.safeParse({ ...VALID, price: "10.55" }).success).toBe(true);
  });

  it("requires at least one description because the create DTO marks it required", () => {
    expect(
      issuePaths(createServiceSchema.safeParse({ ...VALID, descriptionI18n: { es: "  ", en: "" } })),
    ).toContain("descriptionI18n");
  });

  it("accepts an empty, absolute or root-relative image URL only", () => {
    expect(createServiceSchema.safeParse({ ...VALID, imageUrl: "https://x.dev/a.png" }).success).toBe(
      true,
    );
    expect(createServiceSchema.safeParse({ ...VALID, imageUrl: "/uploads/a.png" }).success).toBe(
      true,
    );
    for (const imageUrl of ["not a url", "javascript:alert(1)", "ftp://x.dev/a.png"]) {
      expect(issuePaths(createServiceSchema.safeParse({ ...VALID, imageUrl }))).toContain("imageUrl");
    }
  });
});

describe("updateServiceSchema", () => {
  it("allows empty descriptions (the update DTO marks them optional)", () => {
    expect(
      updateServiceSchema.safeParse({ ...VALID, descriptionI18n: { es: "", en: "" } }).success,
    ).toBe(true);
  });

  it("still enforces the shared field rules", () => {
    expect(issuePaths(updateServiceSchema.safeParse({ ...VALID, duration: "0" }))).toContain(
      "duration",
    );
  });
});

describe("service payload mappers", () => {
  it("maps create values onto the CreateServiceData contract with translation maps", () => {
    expect(toCreateServiceData({ ...VALID, price: "12000.5" }, 7)).toEqual({
      name: "Corte",
      nameI18n: { es: "Corte", en: "Haircut" },
      beautyCenterId: 7,
      categoryId: 1,
      duration: 45,
      price: 12000.5,
      description: "Lavado y corte",
      descriptionI18n: { es: "Lavado y corte", en: "Wash and cut" },
      imageUrl: "",
      isActive: true,
    });
  });

  it("drops blank translations and picks the first non-empty base (registry order)", () => {
    const payload = toCreateServiceData(
      { ...VALID, nameI18n: { es: "", en: "Haircut" }, descriptionI18n: { es: "Lavado" } },
      7,
    );
    expect(payload.name).toBe("Haircut");
    expect(payload.nameI18n).toEqual({ en: "Haircut" });
    expect(payload.descriptionI18n).toEqual({ es: "Lavado" });
  });

  it("omits beautyCenterId on update so a service cannot change centers", () => {
    const payload = toUpdateServiceData(VALID);
    expect(payload).not.toHaveProperty("beautyCenterId");
    expect(payload).toMatchObject({ categoryId: 1, duration: 45, price: 8000 });
  });

  it("pre-fills the form, dropping the base into the default language slot", () => {
    expect(
      serviceToFormValues({
        id: 1,
        beautyCenterId: 7,
        categoryId: 2,
        name: "Massage",
        duration: 60,
        price: 5000,
        isActive: false,
      }),
    ).toEqual({
      nameI18n: { es: "Massage", en: "" },
      descriptionI18n: { es: "", en: "" },
      categoryId: "2",
      duration: "60",
      price: "5000",
      imageUrl: "",
      isActive: false,
    });
  });

  it("pre-fills stored translations when present", () => {
    const values = serviceToFormValues({
      id: 1,
      beautyCenterId: 7,
      categoryId: 2,
      name: "Corte",
      nameI18n: { es: "Corte", en: "Haircut" },
      descriptionI18n: { en: "Wash and cut" },
      duration: 60,
      price: 5000,
    });
    expect(values.nameI18n.en).toBe("Haircut");
    expect(values.descriptionI18n.en).toBe("Wash and cut");
  });
});

describe("categoryFormSchema", () => {
  it("mirrors the API bound (min=3) per language and requires at least one name", () => {
    expect(categoryFormSchema.safeParse(VALID_CATEGORY).success).toBe(true);
    expect(categoryFormSchema.safeParse({ nameI18n: { es: "Ha", en: "" } }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ nameI18n: { es: "", en: "" } }).success).toBe(false);
  });

  it("maps to CreateCategoryData with translation maps", () => {
    expect(toCreateCategoryData(VALID_CATEGORY, 7)).toEqual({
      name: "Cabello",
      nameI18n: { es: "Cabello", en: "Hair" },
      beautyCenterId: 7,
      description: "",
      descriptionI18n: {},
    });
  });
});
