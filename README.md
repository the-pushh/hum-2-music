# hum-2-music

hum is a sketchpad for song ideas. Hum a melody, beatbox a beat, and write lyrics into a sketch, then shape it into a small song in the studio. Everything stays in your browser (IndexedDB). There's no account and no server storage.

## Into your DAW

Every hummed melody and beat card has **MIDI** and **Audio** once hum has heard it:

- **MIDI** is just the notes, at the take's tempo (a beat on the drum channel). Your DAW picks the sound.
- **Audio** is a WAV of the take on the instrument the card plays it on, rendered on the spot.

Tap either to share it (on a phone: AirDrop, Files, another app) or download it (on a computer). In Chrome or Edge on a computer, drag the chip straight onto a DAW track. A web page can't put a file on the clipboard, so dragging is the closest thing to copy and paste.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Tests: `npm test`. Types: `npm run typecheck`.

### Instrument prompt (optional)

A melody card's instrument prompt asks Claude which sound your words mean ("something dreamy and 80s") when it can't tell from the words alone. It needs an Anthropic API key on the server. Put it in `.env.local`, which git ignores, then restart `npm run dev`:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local
```

Only your words and the hum's tempo and key are sent, never recordings or lyrics. Without a key, everything else works and the prompt only reads instrument names.

## Test on your phone

Phones only allow the microphone on **https** pages, so http://192.168.x.x:3000 can't record. Two ways to do it:

**A. Cloudflare quick tunnel (easiest, trusted certificate).** Install `cloudflared` once
(`brew install cloudflared`), then in two terminals:

```bash
npm run dev
cloudflared tunnel --url http://localhost:3000
```

Open the `https://….trycloudflare.com` address it prints on your phone. The tunnel is public while it runs, so
stop it (Ctrl+C) when you're done.

**B. HTTPS on your own network.** Phone and Mac on the same Wi-Fi.

1. Install mkcert (`brew install mkcert && mkcert -install`) and make a certificate for your Mac's address:
   `mkcert -cert-file certificates/lan.pem -key-file certificates/lan-key.pem "$(scutil --get LocalHostName).local" localhost`
2. Install mkcert's root certificate on the phone (`mkcert -CAROOT` shows where it is). On iOS, AirDrop
   `rootCA.pem`, install the profile, then turn it on under Settings → General → About → Certificate Trust
   Settings.
3. Run `npm run dev:https -- --experimental-https-key certificates/lan-key.pem --experimental-https-cert certificates/lan.pem`
   and open `https://<your-mac-name>.local:3000` on the phone.

### What to check on the phone

- Record a hum and play it back (iOS Safari records `audio/mp4`, Android Chrome `audio/webm`).
- Lock the screen or switch apps mid-recording, come back: the take so far is saved as a card.
- Deny mic access once: hum explains how to allow it.
- The mic indicator goes away after every recording.

### Melody checks (M2)

- Hum "Twinkle Twinkle" freely. The pitch line follows your voice while you record, then the card shows
  "Hearing the notes", a key and a strip of notes. **Play as piano** should be recognizably the tune.
- Turn on **Click**, keep 90 BPM and 4 bars, and record. You hear a one-bar count-in, then a click. The take
  stops by itself. The card's notes should sit on the beat, and no extra notes should come from the click.
- Pick a key before recording: the pitch line's guides show only that key's notes, and the card shows that key.
- On the card, switch **Raw**/**Clean**, **Snap**/**As sung** and **1/8**/**1/16**: the strip changes at once.
- Play the piano once, turn on airplane mode, and play it again without reloading: it should still work.
- Watch the pitch line: if it stutters, or the recording skips while it draws, note the phone model.

### Studio checks (M3)

- Hum a melody into a sketch, wait for its notes, then tap **Open in studio**. The hum is a track; **Play** sounds
  like the card's piano and loops it.
- Tap the hum's lane to open the piano roll. With a finger: tap to add a note, drag one to move it, drag its right
  end to make it longer, double tap to delete it. Scrolling the roll with a finger shouldn't add notes.
- Tap **Generate parts**: Chords, Bass and Drums appear and play with the melody. Do they sound like a small song?
- Open the Drums track: tap steps to add, accent and clear hits. Mute, solo and a volume drag work while playing.
- Undo and redo each edit. Reload the page: everything is still there.
- Tap **Export MIDI**, then open the file in another DAW (GarageBand, Logic, Ableton…): one track per part, drums
  on the drum channel, the right tempo.

### Style and instrument checks (M5)

Open an idea with a hum in the studio:

- Tap the Style chip: pick each drum feel, then chords, chord rhythm, bass and energy. Generated parts change straight away, and one Undo takes each pick back.
- With `ANTHROPIC_API_KEY` set, type "something dreamy and 80s" into a melody card's instrument prompt: Claude should offer a sound.

## Sound credits

hum's instruments are played by [smplr](https://github.com/danigb/smplr) (MIT) from these sample sets:

- Electric piano: [Greg Sullivan's E-Pianos](https://github.com/sfzinstruments/GregSullivan.E-Pianos), CC BY 3.0.
- Strings, bass, guitar, synth, pad, flute and brass: the FluidR3_GM soundfont by Frank Wen, from [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts), CC BY 3.0.

See `docs/adr/0002-instrument-sounds.md` for why these.
