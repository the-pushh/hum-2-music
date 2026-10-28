import type { Note, Take } from "@/melody/types";

/** One short slice of a take, as the analyser measures it. */
export type BeatFrame = {
  /** Loudness, as root mean square of the samples. */
  rms: number;
  /** Where the sound's energy sits, in Hz: low for a kick, high for a hi-hat. */
  centroid: number;
  /** 0 for a pure tone, 1 for white noise. */
  flatness: number;
  /** The share of the energy below about 150 Hz. */
  lowShare: number;
};

/** General MIDI drum pitches, the ones the studio's drum machine plays. */
export const drumPitch = { kick: 36, snare: 38, hat: 42 } as const;

/** A hit is this much louder than the frames just before it. */
const riseRatio = 2.5;
/** Quieter than this share of the take's loudest frame is noise, not a hit. */
const floorShare = 0.08;
/** Quieter than this is room noise however quiet the take is: about -40 dBFS. */
const silence = 0.01;
/** Frames compared against when looking for a rise. */
const lookBack = 3;
/** Two hits closer than this are one hit ringing on. */
const minGapSec = 0.06;
/** A hit's sound is measured at its loudest frame within this window after it starts. */
const peakWindowSec = 0.03;
/** Hits are drawn and played this long, in beats. The drum machine ignores length. */
const hitBeats = 0.25;

/** Hears a beat take's hits: kick, snare and hi-hat, in beats at the take's tempo. Velocity is 0–1, from how hard each was hit. */
export function hearBeat(frames: BeatFrame[], hopSec: number, take: Take): Note[] {
  const loudest = Math.max(0, ...frames.map((f) => f.rms));
  if (loudest < silence) return [];
  const floor = Math.max(silence, loudest * floorShare);
  const beatsPerSec = take.bpm / 60;
  const hits: Note[] = [];
  let lastHitSec = -Infinity;

  for (let i = 0; i < frames.length; i++) {
    const { rms } = frames[i];
    if (rms < floor) continue;
    const before = frames.slice(Math.max(0, i - lookBack), i);
    const background = before.length ? Math.max(...before.map((f) => f.rms)) : 0;
    if (rms < background * riseRatio) continue;
    const sec = i * hopSec;
    if (sec - lastHitSec < minGapSec) continue;
    lastHitSec = sec;

    const peak = loudestIn(frames, i, Math.max(1, Math.round(peakWindowSec / hopSec)));
    hits.push({ pitch: drumPitch[classify(peak)], start: sec * beatsPerSec, duration: hitBeats, velocity: Math.min(1, Math.sqrt(peak.rms / loudest)) });
  }
  return hits;
}

function loudestIn(frames: BeatFrame[], from: number, count: number): BeatFrame {
  return frames.slice(from, from + count).reduce((a, b) => (b.rms > a.rms ? b : a));
}

/** Low and tonal is a kick; high and hissy is a hi-hat; a noisy burst in between is a snare. */
function classify({ centroid, flatness, lowShare }: BeatFrame): keyof typeof drumPitch {
  if (lowShare >= 0.45 || centroid < 400) return "kick";
  if (centroid >= 5000 || (centroid >= 3500 && flatness >= 0.5)) return "hat";
  return "snare";
}
