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
      return "hum can't reach your microphone. Check mic access for this site and that no other app is using it, then try again.";
  }
}

/**
 * Explains why the mic didn't start. wavesurfer's record plugin rethrows getUserMedia failures as a plain Error,
 * which loses the reason, so read the cause from the permission state and the device list instead. (Asking for the
 * mic again would show a second prompt on iOS, where a dismissed prompt isn't remembered.)
 */
export async function diagnoseMicFailure(error: unknown): Promise<string> {
  if (!window.isSecureContext || !navigator.mediaDevices) return micErrorMessage(null);
  if (!(error instanceof Error) || !error.message.startsWith("Error accessing the microphone")) {
    return "Recording couldn't start in this browser. Try again, or try another browser.";
  }
  const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName }).catch(() => null);
  if (permission?.state === "denied") return micErrorMessage(new DOMException("", "NotAllowedError"));
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  if (!devices.some((d) => d.kind === "audioinput")) return micErrorMessage(new DOMException("", "NotFoundError"));
  return micErrorMessage(null);
}
