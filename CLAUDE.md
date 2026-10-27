# hum

## Agent skills

### Issue tracker

Issues live in GitHub Issues on the-pushh/hum-2-music (gh CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Next.js

This is Next.js 16 with Cache Components on. Its APIs differ from older versions, so read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Design

UI follows the `landing-page-design` skill, Part B. The tokens live in `src/app/globals.css`: the default Tailwind palette is cleared, so only hum's colors exist. Use only spacing steps 0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, Tailwind's type scale, Phosphor icons, and the `ease-soft` curve. No arbitrary Tailwind values.

## Domain

Ideas are captured into Sketches through the Sketch store (`src/sketches/store.ts`), the only code that touches IndexedDB. Test it through its public interface with fake-indexeddb.
