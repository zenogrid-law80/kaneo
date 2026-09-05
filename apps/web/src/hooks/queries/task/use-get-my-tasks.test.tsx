import {
  MutationObserver,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import getMyTasks from "@/fetchers/task/get-my-tasks";
import useGetMyTasks from "./use-get-my-tasks";

vi.mock("@/fetchers/task/get-my-tasks", () => ({ default: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "me" } } }) },
}));

describe("my tasks cache", () => {
  it("refreshes after a successful editor mutation so completed or unassigned tasks disappear", async () => {
    const fetcher = vi.mocked(getMyTasks);
    fetcher.mockResolvedValueOnce({
      items: [
        {
          id: "task",
          title: "Open",
          number: 1,
          priority: null,
          dueDate: null,
          projectId: "project",
          projectName: "Project",
          projectSlug: "PRO",
        },
      ],
      hasMore: false,
    });
    fetcher.mockResolvedValue({ items: [], hasMore: false });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () => useGetMyTasks("workspace", 1),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    const edit = new MutationObserver(client, {
      mutationFn: async () => ({ status: "done" }),
    });
    await act(() => edit.mutate());
    await waitFor(() => expect(result.current.data?.items).toHaveLength(0));
    expect(fetcher).toHaveBeenCalledWith(
      "workspace",
      1,
      "all",
      expect.any(String),
      expect.any(String),
    );
    unmount();
    client.clear();
  });
});
