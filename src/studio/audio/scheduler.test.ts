// Copied from ComposeYogi (MIT, https://github.com/AppsYogi-com/ComposeYogi at 13fe2f61) and adapted for hum.
// See src/studio/LICENSE-ComposeYogi.
// ============================================
// ComposeYogi — Scheduler Tests
// ============================================
//
// These guard the contract that makes an export sound like the playback:
// both paths schedule from the render plan produced here, so if the plan is
// right for a project, both paths are right for that project.

import { describe, expect, it } from 'vitest';

import {
    initialTrackGain,
    barsToSeconds,
    beatsToSeconds,
    buildRenderPlan,
    effectiveTrackGain,
    isTrackAudible,
    projectEndBar,
    secondsToBars,
} from '@/studio/audio/scheduler';

import { makeClip, makeMixedProject, makeProject, makeTrack } from '@/studio/testFixtures';

// ============================================
// Timing
// ============================================

describe('timing conversions', () => {
    it('converts bars to seconds at 120bpm 4/4', () => {
        // One 4/4 bar at 120bpm is 4 beats × 0.5s = 2s
        expect(barsToSeconds(1, 120, 4)).toBe(2);
        expect(barsToSeconds(4, 120, 4)).toBe(8);
        expect(barsToSeconds(0, 120, 4)).toBe(0);
    });

    it('honours the time signature', () => {
        // 3/4 at 120bpm: three beats per bar
        expect(barsToSeconds(1, 120, 3)).toBe(1.5);
        // 7/8 counts seven beats, whatever the denominator says
        expect(barsToSeconds(1, 120, 7)).toBe(3.5);
    });

    it('scales inversely with tempo', () => {
        expect(barsToSeconds(1, 60, 4)).toBe(4);
        expect(barsToSeconds(1, 240, 4)).toBe(1);
    });

    it('converts beats to seconds', () => {
        expect(beatsToSeconds(1, 120)).toBe(0.5);
        expect(beatsToSeconds(4, 60)).toBe(4);
    });

    it('round-trips bars through seconds', () => {
        for (const bpm of [70, 85, 120, 174]) {
            for (const bars of [0.25, 1, 3.5, 16]) {
                expect(secondsToBars(barsToSeconds(bars, bpm, 4), bpm, 4)).toBeCloseTo(bars, 10);
            }
        }
    });
});

describe('projectEndBar', () => {
    it('is zero for a project with no clips', () => {
        expect(projectEndBar(makeProject({ clips: [] }))).toBe(0);
    });

    it('is the far edge of the last clip, not the last clip in the array', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'late', startBar: 12, lengthBars: 4 }),
                makeClip({ id: 'early', startBar: 0, lengthBars: 2 }),
            ],
        });
        expect(projectEndBar(project)).toBe(16);
    });
});

// ============================================
// Solo / mute
// ============================================

describe('solo and mute gating', () => {
    const plain = makeTrack({ id: 'a' });
    const muted = makeTrack({ id: 'b', muted: true });
    const soloed = makeTrack({ id: 'c', solo: true });

    it('plays every unmuted track when nothing is soloed', () => {
        const tracks = [plain, muted];
        expect(isTrackAudible(plain, tracks)).toBe(true);
        expect(isTrackAudible(muted, tracks)).toBe(false);
    });

    it('silences non-soloed tracks as soon as anything is soloed', () => {
        const tracks = [plain, soloed];
        expect(isTrackAudible(soloed, tracks)).toBe(true);
        expect(isTrackAudible(plain, tracks)).toBe(false);
    });

    it('keeps a muted track silent even when it is also soloed', () => {
        const mutedAndSoloed = makeTrack({ id: 'd', muted: true, solo: true });
        const tracks = [plain, mutedAndSoloed];
        expect(isTrackAudible(mutedAndSoloed, tracks)).toBe(false);
    });

    it('plays all soloed tracks when several are soloed', () => {
        const other = makeTrack({ id: 'e', solo: true });
        const tracks = [plain, soloed, other];
        expect(isTrackAudible(soloed, tracks)).toBe(true);
        expect(isTrackAudible(other, tracks)).toBe(true);
        expect(isTrackAudible(plain, tracks)).toBe(false);
    });

    it('reports gain 0 for anything inaudible and the fader value otherwise', () => {
        const loud = makeTrack({ id: 'f', volume: 0.42 });
        expect(effectiveTrackGain(loud, [loud])).toBe(0.42);
        expect(effectiveTrackGain(muted, [muted])).toBe(0);
        expect(effectiveTrackGain(loud, [loud, soloed])).toBe(0);
    });
});

// ============================================
// Audio clip trimming
// ============================================

describe('a chain is born at the right gain', () => {
    // The second half of "I muted the track and I can still hear it". A track's
    // chain is created lazily by whoever asks for its input first, and on a page
    // where nothing has played that is the live keyboard or an editor preview,
    // not the transport. Those chains used to start at `track.volume`, so a
    // muted track previewed at full level until the transport ran.
    const quiet = makeTrack({ id: 'a', volume: 0.5 });
    const other = makeTrack({ id: 'b', volume: 0.9 });

    it('starts a normal track at its fader', () => {
        expect(initialTrackGain(quiet, [quiet, other])).toBe(0.5);
    });

    it('starts a muted track silent', () => {
        const muted = { ...quiet, muted: true };
        expect(initialTrackGain(muted, [muted, other])).toBe(0);
    });

    it('starts a track silent while another track is soloed', () => {
        const soloed = { ...other, solo: true };
        expect(initialTrackGain(quiet, [quiet, soloed])).toBe(0);
        expect(initialTrackGain(soloed, [quiet, soloed])).toBe(0.9);
    });

    it('still honours mute when nothing has been applied yet', () => {
        // The cold-page case: the mixer has resolved nothing, so nobody is
        // soloed — but mute is still knowable, and mute is the one that was
        // audibly wrong.
        expect(initialTrackGain(quiet, [])).toBe(0.5);
        expect(initialTrackGain({ ...quiet, muted: true }, [])).toBe(0);
        expect(initialTrackGain({ ...quiet, solo: true }, [])).toBe(0.5);
    });

});

describe('buildRenderPlan', () => {
    it('carries the project swing onto the plan', () => {
        // The plan is where both the live and the offline path read it from, so
        // a hard-coded value here would render every export straight however
        // the project was set — and playback would not disagree, because it
        // reads the same wrong number.
        expect(buildRenderPlan(makeProject({ ...makeMixedProject(), swing: 65 })).swing).toBe(65);
    });

    it('treats a project saved before swing existed as straight', () => {
        expect(buildRenderPlan(makeProject({ ...makeMixedProject(), swing: undefined })).swing).toBe(0);
    });

    it('places clips at their bar positions in seconds', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'first', startBar: 0 }),
                makeClip({ id: 'second', startBar: 4 }),
            ],
        });
        const plan = buildRenderPlan(project);

        expect(plan.clips.map((c) => [c.clipId, c.startSeconds])).toEqual([
            ['first', 0],
            ['second', 8],
        ]);
    });

    it('reports the musical duration without any export tail', () => {
        // The arrangement runs to bar 12 (the empty clip still occupies the
        // timeline), and 12 bars at 120bpm 4/4 is 24s.
        const plan = buildRenderPlan(makeMixedProject());
        expect(plan.durationSeconds).toBe(24);
    });

    it('drops clips that cannot make a sound, and audio clips, which hum has none of', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'has-notes' }),
                makeClip({ id: 'no-notes', notes: [] }),
                makeClip({ id: 'audio-without-take', type: 'audio', notes: undefined }),
                makeClip({ id: 'audio-with-take', type: 'audio', notes: undefined, activeTakeId: 'take-1' }),
            ],
        });
        const plan = buildRenderPlan(project);

        expect(plan.clips.map((c) => c.clipId)).toEqual(['has-notes']);
    });

    it('drops clips whose track no longer exists', () => {
        const project = makeProject({
            clips: [makeClip({ id: 'orphan', trackId: 'deleted-track' })],
        });
        expect(buildRenderPlan(project).clips).toHaveLength(0);
    });

    it('marks clips on muted tracks inaudible but still plans them', () => {
        const plan = buildRenderPlan(makeMixedProject());
        const bassClip = plan.clips.find((c) => c.clipId === 'bass-clip');

        expect(bassClip).toBeDefined();
        expect(bassClip?.audible).toBe(false);
    });

    it('applies solo across both tracks and clips', () => {
        const project = makeMixedProject();
        project.tracks = project.tracks.map((t) =>
            t.id === 'keys' ? { ...t, solo: true } : t
        );

        const plan = buildRenderPlan(project);
        const gains = Object.fromEntries(plan.tracks.map((t) => [t.trackId, t.gain]));

        expect(gains).toEqual({ drums: 0, bass: 0, keys: 0.5 });
        expect(plan.clips.filter((c) => c.audible).map((c) => c.clipId)).toEqual(['keys-clip']);
    });

    it('excludes bypassed effects so FX bypass means the same thing live and on export', () => {
        const project = makeProject({
            tracks: [
                makeTrack({
                    effects: [
                        { id: 'on', type: 'reverb', active: true, params: {} },
                        { id: 'off', type: 'delay', active: false, params: {} },
                    ],
                }),
            ],
        });

        const plan = buildRenderPlan(project);
        expect(plan.tracks[0].activeEffects.map((e) => e.id)).toEqual(['on']);
    });

    it('is deterministic — the same project always plans identically', () => {
        const project = makeMixedProject();
        expect(buildRenderPlan(project)).toEqual(buildRenderPlan(project));
    });

    it('matches its recorded shape (golden)', () => {
        // A change to this snapshot means playback AND export both changed.
        // That is allowed — but it must be deliberate.
        expect(buildRenderPlan(makeMixedProject())).toMatchInlineSnapshot(`
          {
            "beatsPerBar": 4,
            "bpm": 120,
            "clips": [
              {
                "audible": true,
                "clipId": "drum-clip",
                "kind": "midi",
                "startSeconds": 0,
                "trackId": "drums",
              },
              {
                "audible": false,
                "clipId": "bass-clip",
                "kind": "midi",
                "startSeconds": 0,
                "trackId": "bass",
              },
              {
                "audible": true,
                "clipId": "keys-clip",
                "kind": "midi",
                "startSeconds": 8,
                "trackId": "keys",
              },
            ],
            "durationSeconds": 24,
            "swing": 0,
            "tracks": [
              {
                "activeEffects": [],
                "audible": true,
                "gain": 0.9,
                "pan": 0,
                "trackId": "drums",
              },
              {
                "activeEffects": [],
                "audible": false,
                "gain": 0,
                "pan": 0,
                "trackId": "bass",
              },
              {
                "activeEffects": [],
                "audible": true,
                "gain": 0.5,
                "pan": 0,
                "trackId": "keys",
              },
            ],
          }
        `);
    });
});
