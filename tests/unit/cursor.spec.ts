import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../src/common/pagination/cursor";

describe("cursor pagination", () => {
  it("round-trips an arbitrary payload", () => {
    const cursor = encodeCursor({ index: 42, note: "hello" });
    expect(decodeCursor<{ index: number; note: string }>(cursor)).toEqual({
      index: 42,
      note: "hello",
    });
  });

  it("never embeds the payload in plain text", () => {
    const cursor = encodeCursor({ secret: "do-not-leak" });
    expect(cursor).not.toContain("do-not-leak");
  });

  it("returns null for a garbage cursor instead of throwing", () => {
    expect(decodeCursor("not-valid-base64url-json")).toBeNull();
  });
});
