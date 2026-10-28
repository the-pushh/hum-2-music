# Glossary

The words hum's code and issues use, and what they mean here.

## Capture

- **Sketch**: one song idea in progress: a title and the Ideas collected for it. Captured with no Sketch open, an Idea starts a new one.
- **Idea**: one thing captured into a Sketch: lyrics, or a voice take (a hummed melody or a beat). Sketches from before M4 may also hold images, links, colors and notes, which still show but can no longer be added. Ideas keep the order the songwriter gives them.
- **Take**: how a voice Idea was recorded: its Take mode, its tempo, whether a click played, and the key chosen beforehand, if any.
- **Take mode**: what a take is of: a **melody** (hummed or sung) or a **beat**. Takes from before M4 are melodies.
- **Beat**: a take of a vocalized drum beat (beatbox). hum hears it as kick, snare and hi-hat hits, not pitches. Hums without a click are measured at the reference tempo, 90 BPM.
- **Transcription**: what hum heard in a voice take: pending, failed, or done. A melody's has raw notes, cleaned-up notes, a key and the cleanup settings; a beat's has raw hits, snapped hits (kick 36, snare 38, hi-hat 42) and the grid.
- **Instrument choice**: what a melody take plays as (piano, keys, strings, bass…), picked on its card after its notes are heard. No choice plays as piano.
- **Note**: a pitch (MIDI number) with a start and a length in beats. Hums store velocity as 0–1; the studio as MIDI's 1–127.

## Studio

- **Arrangement**: a Sketch's studio Project, saved with the Sketch, plus what each hum's notes were when its track was made, so newer hums can be offered.
- **Project**: the studio's model of an Arrangement: tempo, key, scale, time signature, Tracks and Clips (from ComposeYogi).
- **Track**: one part of the Arrangement with its own instrument and mixer settings, and a role (melody, keys, bass, drums…) that sets its color. A Track's origin says whether it came from a hum, from a Generator, or was added by hand.
- **Clip**: a stretch of notes on a Track, placed at a bar.
- **Plan**: the musical frame Generators write into: tempo, key, scale, beats per bar, and how many bars the melody lasts.
- **Generator**: a pure function from a Plan and the melody to a part (chords, bass, drums). The same melody always gives the same part. Generated Tracks are rewritten when parts are generated again; nothing else is touched.
