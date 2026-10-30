import { afterEach, expect, it, vi } from "vite-plus/test";
import { uploadBugAsset } from "./upload-bug-asset";
import { stageBugUpload, finalizeBugUpload } from "@/fetchers/bug/upload";
vi.mock("@/fetchers/bug/upload", () => ({
  stageBugUpload: vi.fn(),
  finalizeBugUpload: vi.fn(),
}));
vi.mock("./i18n", () => ({ i18n: { t: (key: string) => key } }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it.each(["image/png", "video/mp4"])(
  "uploads %s bytes and finalizes before returning editor metadata",
  async (type) => {
    const file = new File(
      ["evidence"],
      type === "image/png" ? "bug.png" : "recording.mp4",
      { type },
    );
    vi.mocked(stageBugUpload).mockResolvedValue({
      key: "key",
      uploadUrl: "https://storage.test/upload",
      headers: { "Content-Type": type },
    });
    vi.mocked(finalizeBugUpload).mockResolvedValue({
      id: "asset",
      url: "/api/asset/asset",
    });
    const put = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", put);
    const result = await uploadBugAsset("project", "bug", file);
    expect(put).toHaveBeenCalledWith("https://storage.test/upload", {
      method: "PUT",
      headers: { "Content-Type": type },
      body: file,
    });
    expect(finalizeBugUpload).toHaveBeenCalledWith("project", {
      bugId: "bug",
      key: "key",
      filename: file.name,
      contentType: type,
      size: 8,
    });
    expect(result).toMatchObject({
      url: "/api/asset/asset",
      kind: type === "image/png" ? "image" : "attachment",
      mimeType: type,
    });
  },
);
it("does not finalize a failed upload", async () => {
  vi.mocked(stageBugUpload).mockResolvedValue({
    key: "key",
    uploadUrl: "https://storage.test/upload",
    headers: {},
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(
    uploadBugAsset("project", undefined, new File(["x"], "video.mp4")),
  ).rejects.toThrow();
  expect(finalizeBugUpload).not.toHaveBeenCalled();
  expect(stageBugUpload).toHaveBeenCalledWith(
    "project",
    expect.objectContaining({ contentType: "video/mp4" }),
  );
});
