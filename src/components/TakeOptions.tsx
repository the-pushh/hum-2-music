"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { allKeys, keyName, sameKey } from "@/melody/keyName";
import { referenceBpm, type Key, type TakeMode } from "@/melody/types";
import { Choice } from "./Choice";

export type TakeOptions = {
  /** null means detect the key from the notes. */
  key: Key | null;
  click: boolean;
  bpm: number;
  bars: 4 | 8;
};

/** Beats start with the click on, so the hits land on a grid hum can follow. */
const defaults: Record<TakeMode, TakeOptions> = {
  melody: { key: null, click: false, bpm: referenceBpm, bars: 4 },
  beat: { key: null, click: true, bpm: referenceBpm, bars: 4 },
};
const storageKey: Record<TakeMode, string> = { melody: "hum.takeOptions", beat: "hum.takeOptions.beat" };
const minBpm = 40;
const maxBpm = 200;

/** The songwriter's last take options for melodies or for beats, remembered in this browser only. */
export function useTakeOptions(mode: TakeMode): [TakeOptions, (changes: Partial<TakeOptions>) => void] {
  const [options, setOptions] = useState(defaults[mode]);

  useEffect(() => {
    let saved: Partial<TakeOptions> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey[mode]) ?? "null");
    } catch {
      // Private windows and blocked storage just start from the defaults.
    }
    setOptions({ ...defaults[mode], ...saved }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [mode]);

  function change(changes: Partial<TakeOptions>) {
    setOptions((current) => {
      const next = { ...current, ...changes };
      try {
        localStorage.setItem(storageKey[mode], JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return [options, change];
}

const iconButton =
  "inline-flex size-6 items-center justify-center rounded-md text-ink-muted transition duration-300 ease-soft hover:bg-line hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

/** Key, click, tempo and length, set before recording. Beats have no key. */
export function TakeOptionsBar({
  mode,
  options,
  onChange,
}: {
  mode: TakeMode;
  options: TakeOptions;
  onChange: (changes: Partial<TakeOptions>) => void;
}) {
  const keyIndex = options.key ? allKeys.findIndex((k) => sameKey(k, options.key!)) : -1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {mode === "melody" && (
        <label className="inline-flex items-center gap-1 rounded-lg bg-raised p-0.5 pl-2 text-xs font-semibold text-ink-muted">
          Key
          <select
            value={keyIndex}
            onChange={(e) => onChange({ key: allKeys[Number(e.target.value)] ?? null })}
            className="rounded-md bg-raised px-1 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <option value={-1}>Auto</option>
            {allKeys.map((k, i) => (
              <option key={i} value={i}>
                {keyName(k)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Choice
        label="Click"
        value={options.click}
        onChange={(click) => onChange({ click })}
        options={[
          { value: false, label: "Free" },
          { value: true, label: "Click" },
        ]}
      />
      {options.click && (
        <>
          <div role="group" aria-label="Tempo" className="inline-flex items-center gap-1 rounded-lg bg-raised p-0.5">
            <button type="button" className={iconButton} disabled={options.bpm <= minBpm} onClick={() => onChange({ bpm: Math.max(minBpm, options.bpm - 5) })}>
              <Minus size={12} aria-hidden />
              <span className="sr-only">Slower</span>
            </button>
            <span className="min-w-12 text-center font-mono text-xs text-ink tabular-nums" aria-live="polite">
              {options.bpm} BPM
            </span>
            <button type="button" className={iconButton} disabled={options.bpm >= maxBpm} onClick={() => onChange({ bpm: Math.min(maxBpm, options.bpm + 5) })}>
              <Plus size={12} aria-hidden />
              <span className="sr-only">Faster</span>
            </button>
          </div>
          <Choice<4 | 8>
            label="Bars"
            value={options.bars}
            onChange={(bars) => onChange({ bars })}
            options={[
              { value: 4, label: "4 bars" },
              { value: 8, label: "8 bars" },
            ]}
          />
        </>
      )}
    </div>
  );
}
