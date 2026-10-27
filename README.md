# hum-2-music

hum is a sketchpad for song ideas. Hum a melody, write lyrics, and collect pictures, links and colours into a
sketch. Everything stays in your browser (IndexedDB). There's no account and no server storage.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Tests: `npm test`. Types: `npm run typecheck`.

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
- Play the piano once, turn on airplane mode, reload, and play it again: it should still work.
- Watch the pitch line: if it stutters, or the recording skips while it draws, note the phone model.
