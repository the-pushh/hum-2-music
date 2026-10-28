"use client";

import * as Tone from "tone";
import { tone } from "./tone";

type ClickOptions = {
  bpm: number;
  /** Bars to record after the one-bar count-in. */
  bars: number;
  /** Each beat of the count-in, 1 to 4, as it sounds. */
  onCountIn: (beat: number) => void;
  /** The downbeat after the count-in: start recording here. */
  onTakeStart: () => void;
  /** The end of the last bar: stop recording here. */
  onTakeEnd: () => void;
};

/**
 * Plays a one-bar count-in, then a click through the take, calling back on the take's first downbeat and at the end
 * of its last bar. Returns a function that stops the click early.
 */
export async function startClick({ bpm, bars, onCountIn, onTakeStart, onTakeEnd }: ClickOptions): Promise<() => void> {
  await tone();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  transport.bpm.value = bpm;
  transport.timeSignature = 4;

  const click = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    volume: -8,
  }).toDestination();

  // Tone calls back slightly ahead of time with the exact audio time; run app callbacks when the sound plays.
  // (Tone's Draw would drop late callbacks, and starting and stopping the take must never be dropped.)
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const when = (time: number, fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, Math.max(0, (time - Tone.immediate()) * 1000));
    timers.add(timer);
  };

  let beat = 0;
  transport.scheduleRepeat(
    (time) => {
      const inBar = beat % 4;
      click.triggerAttackRelease(inBar === 0 ? "C6" : "G5", "32n", time, inBar === 0 ? 1 : 0.6);
      if (beat < 4) when(time, () => onCountIn(inBar + 1));
      beat++;
    },
    "4n",
    0,
    `${bars + 1}m`,
  );
  transport.scheduleOnce((time) => when(time, onTakeStart), "1m");
  transport.scheduleOnce((time) => when(time, onTakeEnd), `${bars + 1}m`);
  transport.start("+0.1");

  return () => {
    timers.forEach(clearTimeout);
    transport.stop();
    transport.cancel();
    click.dispose();
  };
}
