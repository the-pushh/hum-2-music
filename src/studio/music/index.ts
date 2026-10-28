// ============================================
// ComposeYogi — Music theory (copied into hum; see ../LICENSE-ComposeYogi)
// ============================================
// hum leaves out the computer-keyboard modules (typing-keys, keyboard-layout).

export {
    NOTE_NAMES,
    SCALE_INTERVALS,
    SCALE_IDS,
    VIBES,
    matchVibe,
    scalePitchClasses,
    vibeById,
} from './scales';
export type { Vibe } from './scales';

export {
    SNAP_BEATS,
    SNAP_VALUES,
    STRAIGHT_SNAP_VALUES,
    TRIPLET_SNAP_VALUES,
    snapStepBeats,
    snapToGrid,
} from './snap';

export {
    HIGHEST_PITCH,
    LOWEST_PITCH,
    MIDDLE_C,
    PITCH_OCTAVES,
    isPlayablePitch,
    octaveFirstPitch,
    pitchFrequency,
    pitchName,
    pitchOctave,
} from './pitch';

export {
    DRUM_PITCH,
    GM_PERCUSSION,
    GM_PERCUSSION_HIGH,
    GM_PERCUSSION_LOW,
    drumCapLabel,
    drumSoundForPitch,
    drumWindowRange,
} from './percussion';
export type { DrumSound, DrumSoundId } from './percussion';
