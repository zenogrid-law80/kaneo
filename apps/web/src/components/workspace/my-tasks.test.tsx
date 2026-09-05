import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useGetMyTasks from "@/hooks/queries/task/use-get-my-tasks";
import MyTasks from "./my-tasks";

vi.mock("@/lib/format", () => ({ formatDateShort: (value: string) => value }));
vi.mock("@/lib/i18n/domain", () => ({
  getPriorityLabel: (value: string) => value,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-my-tasks", () => ({ default: vi.fn() }));
vi.mock("@/hooks/use-project-websocket", () => ({
  useProjectWebSocket: vi.fn(),
}));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));

describe("my tasks filters", () => {
  it("resets pagination and supports clearing a chip or all filters", () => {
    vi.mocked(useGetMyTasks).mockReturnValue({
      data: { items: [], hasMore: true },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetMyTasks>);
    render(<MyTasks workspaceId="workspace" />);
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:myTasks.next" }),
    );
    expect(useGetMyTasks).toHaveBeenLastCalledWith("workspace", 2, "all");
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:myTasks.today" }),
    );
    expect(useGetMyTasks).toHaveBeenLastCalledWith("workspace", 1, "today");
    expect(screen.getByText("workspace:myTasks.noResults")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:myTasks.removeFilter" }),
    );
    expect(useGetMyTasks).toHaveBeenLastCalledWith("workspace", 1, "all");
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:myTasks.undated" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.clearAllFilters" }),
    );
    expect(useGetMyTasks).toHaveBeenLastCalledWith("workspace", 1, "all");
    expect(
      screen.queryByRole("button", { name: "workspace:myTasks.removeFilter" }),
    ).not.toBeInTheDocument();
  });
});
