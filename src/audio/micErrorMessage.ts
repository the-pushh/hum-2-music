/** What to tell the songwriter when the mic can't start, by the browser's error. */
export function micErrorMessage(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Recording needs a secure connection. Open hum over https, not http.";
  }
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Mic access is blocked for hum. Allow it in your browser's site settings, then tap Record again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone found. Connect one or check your device's sound settings, then try again.";
    case "NotReadableError":
    case "AbortError":
      return "Another app is using the microphone. Close it, then tap Record again.";
    default:
      return "hum can't reach your microphone. Check mic access for this site, then try again.";
  }
}

/**
 * Explains why the mic didn't start. wavesurfer's record plugin rethrows getUserMedia failures as a plain Error,
 * which loses the reason, so ask once more just to read the browser's error. The browser answers from its saved
 * decision, so there's no second prompt; if it works this time, release it straight away.
 */
export async function diagnoseMicFailure(): Promise<string> {
  if (!window.isSecureContext || !navigator.mediaDevices) return micErrorMessage(null);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return micErrorMessage(null);
  } catch (e) {
    return micErrorMessage(e);
  }
}
