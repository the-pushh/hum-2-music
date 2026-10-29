import Anthropic from "@anthropic-ai/sdk";

/** Ways a Claude call can fail that the studio explains to the songwriter. */
export type ClaudeCallError = "not-configured" | "offline" | "upstream" | "timeout" | "invalid-output";

/** Which failure a thrown Claude SDK error is, most specific first. Anything that isn't the SDK's is rethrown. */
export function claudeErrorOf(err: unknown): ClaudeCallError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "not-configured";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.APIConnectionError) return "offline";
  if (err instanceof Anthropic.APIError) return "upstream";
  // The SDK's own parse failures, when Claude's output doesn't fit the schema.
  if (err instanceof Anthropic.AnthropicError) return "invalid-output";
  throw err;
}
