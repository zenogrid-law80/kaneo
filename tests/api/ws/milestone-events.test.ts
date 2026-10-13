import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventContext, publishEvent } from "../../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";

const transport = vi.hoisted(() => ({
  redis: false,
  listeners: new Set<
    (pattern: string, channel: string, data: string) => void
  >(),
}));
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => transport.redis,
  getRedisPub: () => ({
    publish: async (channel: string, data: string) => {
      for (const handler of transport.listeners)
        handler("kaneo:ws:*:broadcast", channel, data);
      return 1;
    },
  }),
  getRedisSub: () => ({
    on: (
      _event: string,
      handler: (pattern: string, channel: string, data: string) => void,
    ) => transport.listeners.add(handler),
    off: (
      _event: string,
      handler: (pattern: string, channel: string, data: string) => void,
    ) => transport.listeners.delete(handler),
    psubscribe: async () => {},
    punsubscribe: async () => {},
  }),
  closeRedis: async () => {},
}));

function socket() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    url: null,
    protocol: null,
  };
}
describe.each([
  ["in-memory", false],
  ["Redis transport", true],
] as const)("milestone events to WebSocket (%s)", (_name, redis) => {
  beforeEach(async () => {
    transport.redis = redis;
    await initializeWebSocketAdapter();
  });
  afterEach(async () => {
    await shutdownWebSocketAdapter();
    vi.unstubAllEnvs();
  });
  it("refreshes remote project windows for metadata and column completion changes", async () => {
    const origin = socket();
    const other = socket();
    const a = addConnection("p1", origin as never, "u1", "origin");
    const b = addConnection("p1", other as never, "u2", "remote");
    await eventContext.run({ initiatorId: "origin" }, () =>
      publishEvent("milestone.updated", { projectId: "p1" }),
    );
    await vi.waitFor(() => expect(other.send).toHaveBeenCalled(), {
      timeout: 500,
    });
    expect(JSON.parse(other.send.mock.calls[0][0])).toMatchObject({
      type: "MILESTONES_UPDATED",
      projectId: "p1",
    });
    expect(origin.send).not.toHaveBeenCalled();
    other.send.mockClear();
    await publishEvent("column.updated", { projectId: "p1" });
    await vi.waitFor(() => expect(other.send).toHaveBeenCalled(), {
      timeout: 500,
    });
    expect(JSON.parse(other.send.mock.calls[0][0]).type).toBe(
      "MILESTONES_UPDATED",
    );
    removeConnection("p1", a);
    removeConnection("p1", b);
  });
  it("sends task membership changes through the task update path", async () => {
    const other = socket();
    const connection = addConnection("p1", other as never, "u1", "remote");
    await publishEvent("task.milestone_changed", {
      taskId: "t1",
      projectId: "p1",
      userId: "u1",
    });
    await vi.waitFor(() => expect(other.send).toHaveBeenCalled(), {
      timeout: 500,
    });
    expect(JSON.parse(other.send.mock.calls[0][0])).toMatchObject({
      type: "TASK_UPDATED",
      projectId: "p1",
      taskId: "t1",
    });
    removeConnection("p1", connection);
  });
});
