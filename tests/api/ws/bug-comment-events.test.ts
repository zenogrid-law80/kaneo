import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { publishEvent } from "../../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws";

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () =>
          fields.userId
            ? Promise.resolve([{ userId: "u1" }, { userId: "u2" }])
            : { limit: async () => [{ workspaceId: "workspace" }] },
      }),
    }),
  },
}));

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
  ["Redis", true],
] as const)("bug comment events (%s)", (_name, redis) => {
  beforeEach(async () => {
    transport.redis = redis;
    await initializeWebSocketAdapter();
  });
  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });
  it("delivers both bug IDs in one batch without comment content", async () => {
    const ws = socket();
    const connection = addConnection(
      "p1",
      ws as never,
      "u1",
      "window",
      "workspace",
    );
    await publishEvent(
      "bug.comments.changed",
      { projectId: "p1", bugId: "bug1", content: "private" },
      { waitForHandlers: true },
    );
    await publishEvent(
      "bug.comments.changed",
      { projectId: "p1", bugId: "bug2" },
      { waitForHandlers: true },
    );
    await vi.waitFor(() => expect(ws.send).toHaveBeenCalledTimes(2), {
      timeout: 500,
    });
    expect(ws.send.mock.calls.map(([message]) => JSON.parse(message))).toEqual([
      { type: "BUG_COMMENTS_UPDATED", projectId: "p1", bugId: "bug1" },
      { type: "BUG_COMMENTS_UPDATED", projectId: "p1", bugId: "bug2" },
    ]);
    removeConnection("p1", connection);
  });
});
