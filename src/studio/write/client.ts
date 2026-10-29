"use client";

import type { WriteRequest } from "./request";
import type { WriteResult } from "./write";

/**
 * Asks the server to write parts with Claude. Network failures come back as `offline`, anything the route couldn't
 * answer as `upstream`; an abort rejects, so callers can tell a cancel from a failure.
 */
export async function postWrite(request: WriteRequest, signal?: AbortSignal): Promise<WriteResult> {
  let response: Response;
  try {
    response = await fetch("/api/write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, error: "offline" };
  }
  return response.json().catch((): WriteResult => ({ ok: false, error: "upstream" }));
}
