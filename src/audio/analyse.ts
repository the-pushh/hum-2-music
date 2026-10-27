import WaveSurfer from "wavesurfer.js";

/** Decodes a recording once with wavesurfer to get its real duration and a compact waveform for the card. */
export async function analyseRecording(blob: Blob): Promise<{ durationSec: number; peaks: number[] }> {
  const ws = WaveSurfer.create({ container: document.createElement("div") });
  try {
    await ws.loadBlob(blob);
    const [peaks] = ws.exportPeaks({ maxLength: 200, precision: 1000 });
    return { durationSec: ws.getDuration(), peaks: Array.from(peaks ?? [], Math.abs) };
  } finally {
    ws.destroy();
  }
}
