import { beforeEach, describe, expect, it } from "vitest";

import { loadScript, resetLoadedScriptsForTests } from "@/presentation/lib/social-auth/scripts";

const SRC = "https://example.test/provider-sdk.js";

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>("script[data-social-sdk]"));
}

describe("social SDK lazy loader", () => {
  beforeEach(() => {
    resetLoadedScriptsForTests();
    for (const script of injectedScripts()) script.remove();
  });

  it("injects nothing until a loader is called", () => {
    expect(injectedScripts()).toHaveLength(0);
  });

  it("injects an async script on demand", () => {
    void loadScript(SRC);

    const scripts = injectedScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(SRC);
    expect(scripts[0].async).toBe(true);
  });

  it("deduplicates concurrent and repeated loads of the same URL", async () => {
    const first = loadScript(SRC);
    const second = loadScript(SRC);

    expect(first).toBe(second);
    expect(injectedScripts()).toHaveLength(1);

    injectedScripts()[0].dispatchEvent(new Event("load"));
    await expect(first).resolves.toBeUndefined();
  });

  it("rejects, removes the tag and clears the cache when the script fails", async () => {
    const promise = loadScript(SRC);
    injectedScripts()[0].dispatchEvent(new Event("error"));

    await expect(promise).rejects.toThrow(/Failed to load provider SDK/);
    expect(injectedScripts()).toHaveLength(0);

    // A retry starts from a clean slate instead of replaying the rejection.
    const retry = loadScript(SRC);
    expect(injectedScripts()).toHaveLength(1);
    injectedScripts()[0].dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });
});
