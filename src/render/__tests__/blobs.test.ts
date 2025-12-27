import { describe, expect, it, vi } from "vitest";
import { collectBlobUrls, revokeBlobs } from "../blobs";

describe("collectBlobUrls", () => {
  it("extracts blob urls from img tags", () => {
    const text = "<img src=\"blob:one\"><img src='blob:two'>";
    expect(collectBlobUrls(text)).toEqual(["blob:one", "blob:two"]);
  });
});

describe("revokeBlobs", () => {
  it("calls URL.revokeObjectURL for each url", () => {
    const spy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    revokeBlobs(["blob:one", "blob:two"]);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
