# 0002: Melody instruments come from smplr, with the FluidR3_GM soundfont

Status: accepted (2026-10-28, M4)

## Context

M4 lets a songwriter choose what a hummed melody plays as: piano, electric piano, strings, bass, guitar, synth, pad, flute or brass. hum already plays its piano and drums through smplr (MIT), and the project rules ask for permissively licensed parts. smplr loads its samples at runtime from public sample sets, each with its own licence.

## Decision

Every melody instrument is a smplr instrument, made in one place (`createSound`) and shared by the voice card and the studio:

| Instrument | smplr source | Samples | Licence |
|---|---|---|---|
| Piano | `SplendidGrandPiano` | Splendid Grand Piano | as M2 |
| Keys (electric piano) | `ElectricPiano`, `WurlitzerEP200` | Greg Sullivan's E-Pianos | CC BY 3.0 |
| Strings, bass, guitar, synth, pad, flute, brass | `Soundfont`, kit `FluidR3_GM` | FluidR3_GM by Frank Wen, via gleitz/midi-js-soundfonts | CC BY 3.0 |

The soundfont kit is always named. smplr's default kit, MusyngKite, is CC BY-SA 3.0, and so is FatBoy, so neither is used. The Versilian Community Sample Library (CC0) was considered, but smplr marks its support as partial.

## Consequences

- CC BY needs credit, so the README lists the sample sets.
- Samples are fetched from GitHub Pages on first use and cached in CacheStorage (`hum-piano`, `hum-instruments`), so each instrument plays offline after its first load.
- Adding an instrument means checking its sample licence first.
