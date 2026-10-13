import type { IStorageRepository } from "yotuvia-core";

/**
 * Web storage adapter for the core's `IStorageRepository` port.
 *
 * Uses `window.localStorage` when it is reachable, and falls back to an
 * in-memory map during SSR / pre-render or when the browser denies storage
 * access (private mode, blocked third-party storage, quota errors). The port
 * contract is async, so callers never need to care which backing store is used.
 */
export class LocalStorageRepository implements IStorageRepository {
  private readonly fallback = new Map<string, string>();

  private get storage(): Storage | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // Reading `window.localStorage` can throw when storage is blocked.
    }
    return null;
  }

  async save(key: string, value: string): Promise<void> {
    const storage = this.storage;
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        // Fall back to memory so auth flows keep working.
      }
    }
    this.fallback.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    const storage = this.storage;
    if (storage) {
      try {
        const value = storage.getItem(key);
        if (value !== null) return value;
      } catch {
        // Fall through to the in-memory fallback.
      }
    }
    return this.fallback.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    const storage = this.storage;
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Fall through to the in-memory fallback.
      }
    }
    this.fallback.delete(key);
  }
}
