---
name: vibe-knowledge-video
description: Use when producing a code-rendered knowledge short in the "Vibe 知识大赏" style for Douyin/Bilibili/Xiaohongshu — vertical, 3-second hook, animated explainer — or when debugging pacing, brightness consistency, BGM mixing, scene overlap, or frame rendering in one.
---

# Vibe Knowledge Video

## Overview

These videos are **not diffusion generations**. The AI writes deterministic HTML/Canvas code; a headless browser renders every frame; ffmpeg encodes. The storyboard is the contract, time is the only input, and QA is part of production.

Core principle: **code is the renderer, JSON is the storyboard, `renderFrame(t)` is the only animation API, and every timeline change triggers a brightness + timing regression.**

## When to Use

- 3–60s vertical knowledge/explainer short, no talking head
- Need crisp text, diagrams, particles, kinetic typography, code-rendered motion
- Need reproducible frames, scene-level revisions, and AI self-review
- Debugging: sudden darkening, inaudible BGM, overlapping scenes, text drift, frozen frames

**Do not use for:** talking-head vlogs, pure stock-footage edits, single static slides, or diffusion/AI-video clips. This skill is for **code-rendered** motion graphics.

## Production Flow

1. **Lock format** — 1080×1920 / 30fps; 3s hook; body 20–35s; H.264 + AAC 320k; target -14 LUFS / ≤ -1 dBTP.
2. **Build the fact base** — `sources.json`; every claim gets a source or an `illustrative`/`fictional` label. No unsourced number on screen.
3. **Script + storyboard** — `script.md` + `storyboard.json`; one idea per ~10s; hook in first 1.5s; end on a transferable line. See `templates/storyboard.json`.
4. **Visual system** — dark background, one accent family, a recurring motif, 3s logo/intro. Use hard cuts for full-screen scene changes; use short crossfades only for small overlapping UI.
5. **Deterministic renderer** — expose `window.renderFrame(t)`; fixed seed; no `Date.now()`/unseeded `Math.random()`; 2× supersample then downscale. See `references/pipeline.md`.
6. **Audio** — SFX + licensed BGM; two-pass loudnorm; BGM-forward, not a synth pad stacked on top. See `references/pipeline.md`.
7. **QA** — `qa.mjs` for duration/resolution/fps/codec/loudness/black/frozen; **brightness check** for per-second `YAVG` drops. See `scripts/brightness-check.mjs`.
8. **AI critique loop** — contact sheet + keyframes + script + sources + critic prompt; only scene/timecode/fix items; max 5 rounds; human gate on facts and final taste.

## Non-Negotiables

- **One timeline source.** If you add an intro or change duration, update every hard-coded time: end fades, flashes, camera keys, HUD transitions. A stale `if (t > 19.55)` fade becomes a **persistent 35% black overlay** and darkens the rest of the video.
- **Absolute vs content-local time.** Pass `c = T - INTRO` to scene functions; text helpers must use the content-local clock. Mixing absolute and local time shifts every caption by the intro length.
- **Brightness regression.** After any timeline change, run the brightness check. A per-second `YAVG` drop > 3 is a bug, not a style choice.
- **Full-screen scenes hard-cut.** Long crossfades between two full-screen UIs produce double exposure (chat card + split panels, pipeline + comparison). Use a hard cut or a short gap.
- **BGM-forward.** When using a user-provided track, mix it at ~0.95 and use **SFX-only** at ~0.55. Do not keep a synthesized pad under it — two beds create a drone that masks the melody. See `references/bgm.md`; the same licensed track was used in GEO and PROMPT.
- **AAC true peak.** 192k AAC can overshoot +2.6 dB on impacts. Encode at 320k and verify the **MP4** true peak, not just the WAV.
- **Copyright.** Never download the trend track. The common one is 《千年之后（氛围版）》 by 艾拉拉/Luv4 — commercial. Ask for a licensed file and integrate it; do not fetch it.
- **Fact boundary.** Benchmark ≠ guarantee. “40% visibility” is a paper benchmark; “24 sources → 3 citations” is illustrative; fictional brands stay fictional.

## Quick Reference

| Item | Default |
|---|---|
| Canvas | 1080×1920 logical, 2× supersample |
| FPS / duration | 30fps; 3s hook + 20–35s body |
| Render | `renderFrame(t)` → `canvas.toDataURL('image/png')` |
| Capture | Puppeteer + existing Chromium, one page, sequential |
| Encode | H.264 CRF 15, `yuv420p`, AAC 320k, faststart |
| Loudness | -14 LUFS, ≤ -1.0 dBTP |
| QA | 9 checks + per-second brightness |
| Review | contact sheet 1fps; keyframes at scene boundaries |

## Commands

```powershell
node render.mjs --start=0 --end=1139 --out=frames
ffmpeg -y -framerate 30 -i frames/%05d.png -i audio/soundtrack_final.wav `
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" `
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p `
  -c:a aac -b:a 320k -ar 48000 -shortest out/final.mp4
node qa.mjs
ffmpeg -i out/final.mp4 -vf "signalstats,metadata=print:file=luma.txt" -an -f null -
node scripts/brightness-check.mjs luma.txt
```

## Common Pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Whole image darkens at ~20s | old end-fade time on a longer timeline; overlay persists | move fade to `DURATION - INTRO - 0.45`; re-render from fade start to end |
| Captions off by 3s after adding intro | `drawLine`/`drawTyped` still use absolute `T` | pass content-local `CT`; replace `T` in text helpers |
| Fake straight road across map | particle trail wraps from route end to start | skip trail segment when `d2 < 0` |
| Two UIs ghosted together | long crossfade between full-screen scenes | hard cut at scene boundary |
| BGM inaudible / sounds like hum | synth pad stacked under BGM | regenerate SFX-only, BGM 0.95 / SFX 0.55 |
| Audio clips after encoding | AAC intersample overshoot at 192k | 320k + limiter at 0.82; verify MP4 TP |
| Rich text fades too early | `t1` still from old scene length | retime `t0/t1` after changing `S2..S5` |

## References

- `references/pipeline.md` — storyboard schema, deterministic renderer, Puppeteer, ffmpeg, audio, QA.
- `references/pitfalls.md` — real production failures and exact fixes.
- `references/bgm.md` — user-provided licensed BGM workflow (same track used in GEO + PROMPT).
- `scripts/brightness-check.mjs` — per-second luma regression detector.
- `scripts/mix-bgm.mjs` — BGM + SFX mixer with two-pass loudnorm and optional remux.
- `templates/storyboard.json` — scene/claim template.
