import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useBugMutations } from "./use-bug-mutations";
import { useBugCommentMutations } from "./use-bug-comment-mutations";
vi.mock("@/fetchers/bug", () => ({
  createBug: vi.fn(async () => ({})),
  updateBug: vi.fn(async () => ({})),
  deleteBug: vi.fn(async () => ({})),
}));
vi.mock("@/fetchers/bug/comments", () => ({
  createBugComment: vi.fn(async () => ({})),
  updateBugComment: vi.fn(async () => ({})),
  deleteBugComment: vi.fn(async () => ({})),
}));
afterEach(cleanup);
it("invalidates home activity after Bug and comment creates, edits and deletes", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(
    () => ({
      bugs: useBugMutations("project"),
      comments: useBugCommentMutations("project", "bug"),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await act(async () => {
    await result.current.bugs.create.mutateAsync({ title: "Bug" });
    await result.current.bugs.update.mutateAsync({
      id: "bug",
      input: { title: "Updated" },
    });
    await result.current.bugs.remove.mutateAsync("bug");
    await result.current.comments.create.mutateAsync("Comment");
    await result.current.comments.update.mutateAsync({
      id: "comment",
      content: "Edited",
    });
    await result.current.comments.remove.mutateAsync("comment");
  });
  await waitFor(() =>
    expect(
      invalidate.mock.calls.filter(
        ([filter]) => filter?.queryKey?.[0] === "workspace-activity",
      ),
    ).toHaveLength(6),
  );
  client.clear();
});
