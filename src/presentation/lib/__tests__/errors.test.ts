import { describe, expect, it } from "vitest";

import { ERROR_FALLBACK_KEY, getErrorStatus, isNetworkError, toErrorKey } from "../errors";

describe("toErrorKey", () => {
  it("maps HTTP status codes to web.errors keys", () => {
    expect(toErrorKey({ status: 401 })).toBe("web.errors.unauthorized");
    expect(toErrorKey({ status: 404 })).toBe("web.errors.not_found_resource");
    expect(toErrorKey({ response: { status: 500 } })).toBe("web.errors.server");
  });

  it("detects transport failures as network errors", () => {
    expect(toErrorKey({ code: "ERR_NETWORK" })).toBe("web.errors.network");
    expect(isNetworkError(new Error("Network Error"))).toBe(true);
    expect(isNetworkError(new Error("boom"))).toBe(false);
  });

  it("falls back for unclassified and undefined errors", () => {
    expect(toErrorKey("boom")).toBe(ERROR_FALLBACK_KEY);
    expect(toErrorKey(new Error("x"), "custom.key")).toBe("custom.key");
    expect(toErrorKey(undefined)).toBe(ERROR_FALLBACK_KEY);
  });
});

describe("getErrorStatus", () => {
  it("reads a direct or nested status", () => {
    expect(getErrorStatus({ status: 400 })).toBe(400);
    expect(getErrorStatus({ response: { status: 422 } })).toBe(422);
  });

  it("returns undefined for non-objects and missing status", () => {
    expect(getErrorStatus(null)).toBeUndefined();
    expect(getErrorStatus("nope")).toBeUndefined();
    expect(getErrorStatus({})).toBeUndefined();
  });
});
