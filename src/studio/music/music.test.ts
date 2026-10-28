// Copied from ComposeYogi (MIT, https://github.com/AppsYogi-com/ComposeYogi at 13fe2f61) and adapted for hum.
// See src/studio/LICENSE-ComposeYogi.
// ============================================
// ComposeYogi — Music Theory Tests
// ============================================
//
// Two things are being held down here.
//
// The scale tests exist because the app shipped with three disagreeing answers
// to "what scales are there": the type had nine, the Inspector offered thirteen,
// and the interval table knew nine — a different nine. Choosing Harmonic Minor
// therefore highlighted natural minor and said nothing about it. Nothing threw,
// which is why it survived. Every test below is a way for those lists to be
// caught disagreeing again.
//
// The snap tests are arithmetic, and arithmetic is exactly what a triplet grid
// gets wrong: three notes in the space of two is easy to write as 1/3 of a beat
// and be a hair out over a bar.


import { describe, expect, it } from 'vitest';

import {
    DRUM_PITCH,
    GM_PERCUSSION,
    GM_PERCUSSION_HIGH,
    GM_PERCUSSION_LOW,
    HIGHEST_PITCH,
    LOWEST_PITCH,
    MIDDLE_C,
    NOTE_NAMES,
    PITCH_OCTAVES,
    isPlayablePitch,
    octaveFirstPitch,
    pitchFrequency,
    pitchName,
    pitchOctave,
    SCALE_IDS,
    SCALE_INTERVALS,
    drumSoundForPitch,
    SNAP_BEATS,
    SNAP_VALUES,
    STRAIGHT_SNAP_VALUES,
    TRIPLET_SNAP_VALUES,
    VIBES,
    matchVibe,
    scalePitchClasses,
    snapStepBeats,
    snapToGrid,
    vibeById,
} from '@/studio/music';

import type { MusicalScale, SnapValue } from '@/studio/types';


/**
 * Every scale, as values rather than types. A type-level check cannot run at
 * runtime, and this list is what the exhaustiveness tests compare against.
 */
const ALL_SCALES: MusicalScale[] = [
    'major', 'minor', 'harmonicMinor', 'melodicMinor',
    'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'pentatonicMajor', 'pentatonicMinor', 'blues', 'chromatic',
];

const ALL_SNAP_VALUES: SnapValue[] = [
    'off', '1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T',
];

// ============================================
// Scales
// ============================================

describe('every scale is complete', () => {
    it('covers the whole type — the test list is not stale', () => {
        // Guards the lists below: a scale added to MusicalScale but not to
        // ALL_SCALES would make every test here pass without checking it.
        expect(Object.keys(SCALE_INTERVALS).sort()).toEqual([...ALL_SCALES].sort());
    });

    it('has intervals', () => {
        for (const scale of ALL_SCALES) {
            expect(SCALE_INTERVALS[scale], `${scale} has no intervals`).toBeTruthy();
            expect(SCALE_INTERVALS[scale].length).toBeGreaterThan(0);
        }
    });

    it('has a place in the picker', () => {
        // The original bug in reverse: a scale the type knows about that no
        // picker offers is unreachable, which is what `pentatonic` was.
        const missing = ALL_SCALES.filter((scale) => !(SCALE_IDS as readonly string[]).includes(scale));
        expect(missing, 'add it to SCALE_IDS or it cannot be chosen').toEqual([]);
    });


    it('is a set of ascending semitones inside one octave', () => {
        for (const scale of ALL_SCALES) {
            const intervals = SCALE_INTERVALS[scale];
            expect(intervals[0], `${scale} does not start on its root`).toBe(0);
            expect(Math.max(...intervals), `${scale} leaves the octave`).toBeLessThan(12);
            expect(Math.min(...intervals), `${scale} has a negative interval`).toBeGreaterThanOrEqual(0);

            const ascending = intervals.every((n, i) => i === 0 || n > intervals[i - 1]);
            expect(ascending, `${scale} is not in ascending order`).toBe(true);
            expect(new Set(intervals).size, `${scale} repeats an interval`).toBe(intervals.length);
        }
    });
});

describe('scalePitchClasses', () => {
    it('roots the scale on the chosen key', () => {
        expect([...scalePitchClasses('C', 'major')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
        // A minor is C major's relative — same notes, different root.
        expect([...scalePitchClasses('A', 'minor')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('wraps past B rather than running off the end', () => {
        const classes = scalePitchClasses('A#', 'major');
        expect([...classes].every((pc) => pc >= 0 && pc < 12)).toBe(true);
        expect(classes.size).toBe(7);
    });

    it('admits every note under chromatic and rejects none', () => {
        expect(scalePitchClasses('F', 'chromatic').size).toBe(12);
    });

    it('names notes so that NOTE_NAMES[pitch % 12] is the note', () => {
        expect(NOTE_NAMES[60 % 12]).toBe('C');   // middle C
        expect(NOTE_NAMES[69 % 12]).toBe('A');   // A440
    });
});

// ============================================
// Vibes
// ============================================

describe('vibes', () => {
    it('resolve to a real key and a real scale', () => {
        for (const vibe of VIBES) {
            expect(NOTE_NAMES, `${vibe.id} has an unknown key`).toContain(vibe.key);
            expect(ALL_SCALES, `${vibe.id} has an unknown scale`).toContain(vibe.scale);
        }
    });


    it('never share a key and scale', () => {
        // matchVibe returns the first hit, so two vibes on the same pair would
        // make the transport label whichever one was declared first — the
        // control would silently disagree with the click that set it.
        const pairs = VIBES.map((v) => `${v.key} ${v.scale}`);
        expect(new Set(pairs).size).toBe(VIBES.length);
    });

    it('round-trip through matchVibe', () => {
        for (const vibe of VIBES) {
            expect(matchVibe(vibe.key, vibe.scale)?.id).toBe(vibe.id);
        }
    });

    it('report no match rather than guessing', () => {
        // C locrian is nobody's vibe. Falling back to the first one would put a
        // label on the transport that the piano roll then contradicts.
        expect(matchVibe('C', 'locrian')).toBeNull();
    });

    it('look up by id, and refuse an id that is not one', () => {
        expect(vibeById('chill')?.scale).toBe('dorian');
        // @ts-expect-error — the guard is for values arriving from storage
        expect(vibeById('nonsense')).toBeUndefined();
    });
});

// ============================================
// Snap
// ============================================

describe('snap resolutions', () => {
    it('cover the whole type — the test list is not stale', () => {
        expect(Object.keys(SNAP_BEATS).sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });

    it('are all offered by the picker exactly once', () => {
        expect([...SNAP_VALUES].sort()).toEqual([...ALL_SNAP_VALUES].sort());
        expect(new Set(SNAP_VALUES).size).toBe(SNAP_VALUES.length);
    });

    it('halve at each straight division, with a quarter note worth one beat', () => {
        expect(SNAP_BEATS['1/4']).toBe(1);
        for (let i = 1; i < STRAIGHT_SNAP_VALUES.length; i++) {
            expect(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i]])
                .toBeCloseTo(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i - 1]] / 2, 10);
        }
    });

    it('fit three triplets into the space of two straight notes', () => {
        const pairs = [['1/4T', '1/4'], ['1/8T', '1/8'], ['1/16T', '1/16']] as const;
        for (const [triplet, straight] of pairs) {
            expect(SNAP_BEATS[triplet] * 3, `${triplet} does not fill two ${straight}`)
                .toBeCloseTo(SNAP_BEATS[straight] * 2, 10);
        }
    });

    it('lands three eighth-note triplets exactly on the next beat', () => {
        // The arithmetic a naive 1/3 gets wrong: three of them must reach 1.0
        // exactly, or a triplet figure drifts a little further off every bar.
        expect(SNAP_BEATS['1/8T'] * 3).toBeCloseTo(1, 12);
        expect(SNAP_BEATS['1/16T'] * 6).toBeCloseTo(1, 12);
    });

    it('offers every division in one group or the other', () => {
        const grouped = [...STRAIGHT_SNAP_VALUES, ...TRIPLET_SNAP_VALUES, 'off'];
        expect([...grouped].sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });
});

describe('snapToGrid', () => {
    it('rounds to the nearest division', () => {
        expect(snapToGrid(0.3, '1/4')).toBe(0);
        expect(snapToGrid(0.6, '1/4')).toBe(1);
        expect(snapToGrid(1.3, '1/8')).toBeCloseTo(1.5, 10);
    });

    it('leaves a value alone when snapping is off', () => {
        // The point of the setting: a note nudged deliberately off the grid has
        // to survive being dragged.
        expect(snapToGrid(1.234, 'off')).toBe(1.234);
        expect(snapToGrid(-0.5, 'off')).toBe(-0.5);
    });

    it('puts an off-beat eighth on the triplet grid', () => {
        // 0.5 of a beat is nearer the second eighth-triplet (0.666…) than the
        // first (0.333…) only by a hair — this is the rounding that decides
        // whether a shuffle lands.
        expect(snapToGrid(0.5, '1/8T')).toBeCloseTo(2 / 3, 10);
        expect(snapToGrid(0.3, '1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('does not drift over a bar of triplets', () => {
        for (let i = 0; i <= 12; i++) {
            const exact = i * SNAP_BEATS['1/8T'];
            expect(snapToGrid(exact + 0.001, '1/8T')).toBeCloseTo(exact, 9);
        }
    });
});

describe('snapStepBeats', () => {
    it('is the snap resolution when snapping is on', () => {
        expect(snapStepBeats('1/16')).toBe(0.25);
        expect(snapStepBeats('1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('is never zero, so a new note always has a length', () => {
        // Drawing at snap=off used to be the trap: the raw value is 0, and a
        // note of no length is silent and unclickable.
        for (const snap of ALL_SNAP_VALUES) {
            expect(snapStepBeats(snap), `${snap} yields a zero-length note`).toBeGreaterThan(0);
        }
    });
});

// ============================================
// What a pitch is called, and where it sounds
// ============================================
//
// The third disagreeing list, found the way the first one was — by someone
// playing the app and saying it sounded wrong. `PianoRoll`'s key column and the
// live keyboard both named a pitch `Math.floor(pitch / 12)`, so MIDI 60 was
// drawn as "C5"; `PianoRoll`'s own `noteName`, two hundred lines away in the
// same file, subtracted the one and called it C4. Nothing threw.
//
// It was not only cosmetic. The live keyboard's lowest offered octave was
// labelled "C1" and was MIDI 12 — C0, **16.35 Hz**, below the bottom of human
// hearing and far below what a laptop speaker moves. Held against an online
// piano's C1 at 32.70 Hz it sounds broken, because it is: an octave lower than
// its own label, in a range nothing can reproduce.

describe('a pitch has one name, and it is the one everyone else uses', () => {
    it('puts middle C where middle C is', () => {
        expect(MIDDLE_C).toBe(60);
        expect(pitchName(MIDDLE_C)).toBe('C4');
        expect(pitchOctave(MIDDLE_C)).toBe(4);
    });

    it('names the octave below MIDI 12 correctly', () => {
        // The old formula said "C1" here. It is C0, and the difference is an
        // octave of pitch that does not exist on a piano.
        expect(pitchName(12)).toBe('C0');
        expect(pitchName(24)).toBe('C1');
    });

    it('names every pitch class', () => {
        for (let i = 0; i < 12; i++) {
            expect(pitchName(MIDDLE_C + i)).toBe(`${NOTE_NAMES[i]}4`);
        }
    });

    it('round-trips an octave through its first pitch', () => {
        for (let octave = 0; octave <= 8; octave++) {
            expect(pitchOctave(octaveFirstPitch(octave))).toBe(octave);
            expect(pitchName(octaveFirstPitch(octave))).toBe(`C${octave}`);
        }
    });
});

describe('the playable range is one a speaker can reproduce', () => {
    it('starts at C1 and ends at B7', () => {
        expect(pitchName(LOWEST_PITCH)).toBe('C1');
        expect(pitchName(HIGHEST_PITCH)).toBe('B7');
        expect(PITCH_OCTAVES).toBe(7);
    });

    it('never offers a note below what a speaker can move', () => {
        // 20 Hz is the bottom of hearing; a laptop is lucky to reach 80. The old
        // floor was 16.35 Hz, which is cone travel and no note.
        expect(pitchFrequency(LOWEST_PITCH)).toBeGreaterThan(30);
        expect(pitchFrequency(LOWEST_PITCH - 12)).toBeLessThan(20);
    });

    it('agrees with a tuner', () => {
        expect(pitchFrequency(69)).toBeCloseTo(440, 6);
        expect(pitchFrequency(MIDDLE_C)).toBeCloseTo(261.626, 2);
        expect(pitchFrequency(LOWEST_PITCH)).toBeCloseTo(32.703, 2);
        expect(pitchFrequency(HIGHEST_PITCH)).toBeCloseTo(3951.066, 2);
    });

    it('rejects what it cannot draw rather than moving it', () => {
        // Not a clamp: an out-of-range pitch is a bug at the call site, and
        // silently shifting it an octave is how a wrong note becomes a mystery.
        expect(isPlayablePitch(LOWEST_PITCH)).toBe(true);
        expect(isPlayablePitch(HIGHEST_PITCH)).toBe(true);
        expect(isPlayablePitch(LOWEST_PITCH - 1)).toBe(false);
        expect(isPlayablePitch(HIGHEST_PITCH + 1)).toBe(false);
        expect(isPlayablePitch(60.5)).toBe(false);
    });
});

describe('General MIDI percussion', () => {
    it('covers 35 to 81 exactly once each, with nothing outside', () => {
        // The comment above the old list said "Full GM percussion set: MIDI
        // notes 35-81" and sat above 46 of the 47 — Vibraslap (58) was simply
        // absent. A range check is the only thing that notices a missing middle.
        const pitches = GM_PERCUSSION.map((sound) => sound.pitch).sort((a, b) => a - b);
        const expected = Array.from(
            { length: GM_PERCUSSION_HIGH - GM_PERCUSSION_LOW + 1 },
            (_, index) => GM_PERCUSSION_LOW + index
        );
        expect(pitches).toEqual(expected);
    });

    it('gives every sound a unique id, name and short name', () => {
        // `DRUM_PITCH` is built by folding the array into a record, so a
        // duplicate id silently drops a sound's pitch rather than erroring.
        for (const field of ['id', 'name', 'shortName'] as const) {
            const values = GM_PERCUSSION.map((sound) => sound[field]);
            expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
        }
    });

    it('keeps short names to three characters, the width of a lane rail', () => {
        for (const sound of GM_PERCUSSION) {
            expect(sound.shortName, sound.name).toHaveLength(3);
        }
    });

    it('reaches every sound by pitch, and nothing outside the range', () => {
        for (const sound of GM_PERCUSSION) {
            expect(drumSoundForPitch(sound.pitch)).toEqual(sound);
        }
        expect(drumSoundForPitch(GM_PERCUSSION_LOW - 1)).toBeNull();
        expect(drumSoundForPitch(GM_PERCUSSION_HIGH + 1)).toBeNull();
        expect(drumSoundForPitch(60.5)).toBeNull();
    });

    it('names the pitches the kits and templates are keyed by', () => {
        // The specific numbers the six samplers and every demo template depend
        // on. Written out rather than derived, because deriving them from the
        // same array they are meant to pin proves nothing — and because these
        // are the General MIDI standard, not this app's choice.
        expect(DRUM_PITCH.acousticBassDrum).toBe(35);
        expect(DRUM_PITCH.kick).toBe(36);
        expect(DRUM_PITCH.sideStick).toBe(37);
        expect(DRUM_PITCH.snare).toBe(38);
        expect(DRUM_PITCH.handClap).toBe(39);
        expect(DRUM_PITCH.electricSnare).toBe(40);
        expect(DRUM_PITCH.closedHat).toBe(42);
        expect(DRUM_PITCH.pedalHat).toBe(44);
        expect(DRUM_PITCH.openHat).toBe(46);
        expect(DRUM_PITCH.ride).toBe(51);
        expect(DRUM_PITCH.cowbell).toBe(56);
    });

});