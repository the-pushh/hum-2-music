/** Safari records AAC in mp4; Chrome and Firefox prefer Opus in webm. Undefined lets the browser choose. */
export function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
}
