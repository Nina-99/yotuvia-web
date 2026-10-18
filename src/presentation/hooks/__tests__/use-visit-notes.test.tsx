import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMine, upsert, remove } = vi.hoisted(() => ({
  listMine: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
}));

// The container builds every repository at import time, so tests replace it
// with the smallest possible double for the hooks under test.
vi.mock("@/di/container", () => ({
  dependencies: {
    visitNoteRepository: { listMine, upsert, remove },
  },
}));

import { useMyVisitNotes, useUpsertVisitNote } from "../use-visit-notes";

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("use-visit-notes", () => {
  beforeEach(() => {
    listMine.mockReset();
    upsert.mockReset();
    remove.mockReset();
  });

  it("loads the caller's notes over the range", async () => {
    listMine.mockResolvedValue([{ id: 1, reservationId: 7, body: "note" }]);

    const { result } = renderHook(() => useMyVisitNotes("2026-10-01", "2026-10-31"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listMine).toHaveBeenCalledWith("2026-10-01", "2026-10-31");
    expect(result.current.data).toEqual([{ id: 1, reservationId: 7, body: "note" }]);
  });

  it("upserts a note with the reservation id and body", async () => {
    upsert.mockResolvedValue({ id: 1, reservationId: 7, body: "fresh" });

    const { result } = renderHook(() => useUpsertVisitNote(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ reservationId: 7, body: "fresh" });

    expect(upsert).toHaveBeenCalledWith(7, "fresh");
  });
});
