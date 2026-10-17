import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../src/common/pagination/cursor";

describe("cursor pagination helper", () => {
  it("round-trips a value through encode/decode", () => {
    const cursor = encodeCursor({ sequence: "42" });
    expect(decodeCursor<{ sequence: string }>(cursor)).toEqual({
      sequence: "42",
    });
  });

  it("returns null for a malformed cursor instead of throwing", () => {
    expect(decodeCursor("not-valid-base64url-json")).toBeNull();
  });
});
