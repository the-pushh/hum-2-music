// Copied from ComposeYogi (MIT, https://github.com/AppsYogi-com/ComposeYogi at 13fe2f61) and adapted for hum.
// See src/studio/LICENSE-ComposeYogi.
// ============================================
// ComposeYogi — MIDI Export
// Export project clips to standard MIDI file
// ============================================

import { Midi } from '@tonejs/midi';
import { instrumentOfPreset, instruments } from '@/instruments/instruments';
import { sampleVelocity } from '@/export/takeEvents';
import type { Project, Clip, Track } from '@/studio/types';


// ============================================
// Constants
// ============================================

/** hum's generated parts' synth presets, as their nearest General MIDI programs (0-based). */
const GENERATED_PROGRAMS: Record<string, number> = {
    'warm-pad': 89, // Pad 2 (warm)
    'synth-bass': 38, // Synth Bass 1
};

/** The General MIDI program for a track's preset: a hum's chosen instrument, or a generated part's synth. */
function programFor(preset: string | undefined): number | undefined {
    const instrument = instrumentOfPreset(preset);
    return instrument ? instruments[instrument].program : preset ? GENERATED_PROGRAMS[preset] : undefined;
}

// GM Drum channel (channel 10, but 0-indexed = 9)
const DRUM_CHANNEL = 9;


// ============================================
// Export Functions
// ============================================

/**
 * Export a project to MIDI format
 */
export function exportProjectToMidi(project: Project): Midi {
    const midi = new Midi();

    // Set header info
    midi.header.setTempo(project.bpm);
    midi.header.timeSignatures.push({
        ticks: 0,
        timeSignature: [project.timeSignature[0], project.timeSignature[1]],
        measures: 0,
    });
    midi.header.name = project.name;

    // Create a map of trackId -> track for quick lookup
    const trackMap = new Map<string, Track>();
    for (const track of project.tracks) {
        trackMap.set(track.id, track);
    }

    // Group clips by track
    const clipsByTrack = new Map<string, Clip[]>();
    for (const clip of project.clips) {
        if (!clipsByTrack.has(clip.trackId)) {
            clipsByTrack.set(clip.trackId, []);
        }
        clipsByTrack.get(clip.trackId)!.push(clip);
    }

    // Process each track
    let midiChannelIndex = 0;
    for (const track of project.tracks) {
        const clips = clipsByTrack.get(track.id) || [];

        // Skip audio tracks (they have no MIDI data)
        if (track.type === 'audio') continue;

        // Skip tracks with no clips
        if (clips.length === 0) continue;

        // Create MIDI track
        const midiTrack = midi.addTrack();
        midiTrack.name = track.name;

        // Determine channel
        const isDrum = track.type === 'drum';
        const channel = isDrum ? DRUM_CHANNEL : midiChannelIndex++;

        // Skip channel 9 for melodic tracks
        if (!isDrum && midiChannelIndex === DRUM_CHANNEL) {
            midiChannelIndex++;
        }

        // Cap at 16 channels
        if (midiChannelIndex > 15) {
            midiChannelIndex = 0;
        }

        midiTrack.channel = channel;

        // Each track gets the General MIDI program nearest its sound, so other DAWs open it sounding close.
        const program = isDrum ? undefined : programFor(track.instrumentPreset);
        if (program !== undefined) midiTrack.instrument.number = program;

        // hum: a track on one of hum's instruments plays on the samples' 40–110 range, so it's written at that
        // loudness too. At the full 127, most DAW instruments sound much brighter and harsher than the studio did.
        const humInstrument = !isDrum && instrumentOfPreset(track.instrumentPreset) !== undefined;

        // Process each clip
        for (const clip of clips) {
            if (!clip.notes || clip.notes.length === 0) continue;

            // Convert clip position to seconds
            const clipStartSeconds = barToSeconds(clip.startBar, project.bpm, project.timeSignature[0]);

            for (const note of clip.notes) {
                // Convert note timing
                const noteStartSeconds = clipStartSeconds + beatToSeconds(note.startBeat, project.bpm);
                const noteDurationSeconds = beatToSeconds(note.duration, project.bpm);

                midiTrack.addNote({
                    midi: note.pitch,
                    time: noteStartSeconds,
                    duration: noteDurationSeconds,
                    velocity: (humInstrument ? sampleVelocity(note.velocity / 127) : note.velocity) / 127, // Normalize to 0-1
                });
            }
        }
    }

    return midi;
}

/**
 * Export project to MIDI and trigger download
 */
export function downloadProjectAsMidi(project: Project): void {
    const midi = exportProjectToMidi(project);
    const array = midi.toArray();
    // Convert to ArrayBuffer for Blob compatibility
    const buffer = new ArrayBuffer(array.length);
    const view = new Uint8Array(buffer);
    view.set(array);
    const blob = new Blob([buffer], { type: 'audio/midi' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(project.name)}.mid`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup. hum: later, since iOS Safari can drop a download whose URL is revoked straight away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert bar number to seconds
 */
function barToSeconds(bar: number, bpm: number, beatsPerBar: number): number {
    const secondsPerBeat = 60 / bpm;
    return bar * beatsPerBar * secondsPerBeat;
}

/**
 * Convert beats to seconds
 */
function beatToSeconds(beats: number, bpm: number): number {
    const secondsPerBeat = 60 / bpm;
    return beats * secondsPerBeat;
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '') // Remove illegal characters
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .slice(0, 100)                 // Limit length
        || 'project';                  // Fallback
}
