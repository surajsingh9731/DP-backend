/**
 * Opaque keyset-pagination cursor. Every list endpoint in this backend pages
 * by a monotonic column (usually `sequence`) rather than OFFSET, so a page
 * stays stable while new rows are being written. The cursor carries no
 * authorization of its own — every read re-checks tenant/role scope, same as
 * the first page.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(
  cursor: string,
): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
