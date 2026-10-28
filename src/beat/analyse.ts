"use client";

import Meyda from "meyda";
import type { BeatFrame } from "./hearBeat";

export const analysisRate = 22050;
/** 512 samples is 23 ms at 22050 Hz: short enough to tell hits apart, long enough to hear a kick's low end. */
const windowSize = 512;
/** A frame every 10 ms. */
const hop = 220;
export const hopSec = hop / analysisRate;
/** Below this is a kick's thump. */
const lowHz = 150;

/**
 * Measures a mono take, frame by frame, for hearing its hits. A frame stands for the middle of its window, so a hit is
 * placed where its sound is, not where the window starts.
 */
export function beatFrames(samples: Float32Array): BeatFrame[] {
  Meyda.bufferSize = windowSize;
  Meyda.sampleRate = analysisRate;
  const binHz = analysisRate / windowSize;
  const frames: BeatFrame[] = [];
  const centre = Math.round(windowSize / 2 / hop);
  for (let start = 0; start + windowSize <= samples.length; start += hop) {
    const f = Meyda.extract(["rms", "amplitudeSpectrum", "spectralFlatness"], samples.subarray(start, start + windowSize));
    const spectrum = f?.amplitudeSpectrum ?? new Float32Array();
    let total = 0;
    let weighted = 0;
    let low = 0;
    spectrum.forEach((a, bin) => {
      const power = a * a;
      total += power;
      weighted += power * bin * binHz;
      if (bin * binHz < lowHz) low += power;
    });
    frames.push({
      rms: f?.rms ?? 0,
      centroid: total ? weighted / total : 0,
      flatness: Number.isFinite(f?.spectralFlatness) ? (f?.spectralFlatness ?? 0) : 0,
      lowShare: total ? low / total : 0,
    });
  }
  // Shift so frame i describes the sound around i × hop, rather than the window starting there.
  return [...Array.from({ length: centre }, () => ({ rms: 0, centroid: 0, flatness: 0, lowShare: 0 })), ...frames];
}
