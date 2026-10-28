"use client";

import type { DescribeRequest, DescribeResult } from "./describe";

/**
 * Asks the server to read a description with Claude. Network failures come back as `offline`, anything the route
 * couldn't answer as `upstream`; an abort rejects, so callers can tell a cancel from a failure.
 */
export async function postDescription(request: DescribeRequest, signal?: AbortSignal): Promise<DescribeResult> {
  let response: Response;
  try {
    response = await fetch("/api/describe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, error: "offline" };
  }
  return response.json().catch((): DescribeResult => ({ ok: false, error: "upstream" }));
}
