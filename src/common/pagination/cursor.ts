/** Opaque, base64url-encoded keyset cursors — never a raw offset, never guessable row data. */
export function encodeCursor<T>(payload: T): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
