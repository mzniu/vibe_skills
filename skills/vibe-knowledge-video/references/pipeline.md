# Pipeline Reference

## 1. Project layout

```
project/
  index.html          # every visual; window.renderFrame(t)
  render.mjs          # Puppeteer -> PNG frames
  audio.mjs           # synthesized SFX / placeholder bed
  normalize-audio.mjs # two-pass loudnorm
  mix-bgm.mjs         # licensed BGM + SFX
  build.ps1           # audio -> frames -> encode -> contact sheet -> QA
  qa.mjs              # ffprobe + ebur128 + blackdetect + freezedetect
  storyboard.json     # timing/copy/visual/audio contract
  script.md           # spoken/on-screen copy + fact boundary
  sources.json        # claim -> source / illustrative / fictional
  frames/             # intermediate PNGs
  out/                # final MP4, contact sheet, waveforms
```

## 2. Storyboard contract

Use `templates/storyboard.json`. Every scene has:

- `id`, `start`, `end`
- `copy[]` — what the viewer reads
- `visual` — what is on screen
- `effect` — motion/post treatment
- `audio` — sound events and their timestamps

Keep a separate `claims[]` with `source`, `on_screen`, and `note`. If a number is illustrative, say so in `note` and consider a footnote on screen.

## 3. Deterministic renderer pattern

```js
const W = 1080, H = 1920, SS = 2;
canvas.width = W * SS; canvas.height = H * SS;
ctx.setTransform(SS, 0, 0, SS, 0, 0);

function renderFrame(t) {
  const c = t - INTRO;       // content-local time
  CT = c;                    // text helpers use CT, not absolute t
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawBackground(t);
  drawScrims();              // scrims BEFORE scene copy
  if (t < INTRO + 0.4) drawIntro(t);
  // ... draw scenes with c ...
  drawHUD(c);
  postProcess(c);
  return canvas.toDataURL('image/png');
}
```

Rules:

- Seed every PRNG: `mulberry32(seed)`.
- No `Date.now()`, no unseeded `Math.random()`.
- No reliance on `requestAnimationFrame` for final output.
- Supersample 2×, then downscale in ffmpeg.
- Expose `window.renderFrame` and `window.__ready` for Puppeteer.

## 4. Puppeteer capture

```js
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(url + '?render=1');
await page.waitForFunction('window.__ready === true');
for (let f = start; f <= end; f++) {
  const dataUrl = await page.evaluate(t => window.renderFrame(t), f / 30);
  fs.writeFileSync(`frames/${String(f).padStart(5,'0')}.png`,
    Buffer.from(dataUrl.split(',')[1], 'base64'));
}
```

Render in chunks/foreground for long jobs. Background shell jobs may be killed when the session exits; always check the last rendered frame and resume from `last + 1`.

## 5. Encode

```bash
ffmpeg -y -framerate 30 -i frames/%05d.png -i audio/soundtrack_final.wav \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 15 -profile:v high -level 4.1 \
  -x264-params "aq-mode=3:aq-strength=1.0" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  out/final.mp4
```

## 6. Audio

- **SFX-only**: impacts, whooshes, ticks, chimes; no pad/melody when a BGM will be added.
- **Two-pass loudnorm**: measure first, then normalize with `measured_I/TP/LRA/thresh/offset`, add `volume=-1.2dB`, `alimiter=limit=0.82`.
- **BGM mix**: BGM ~0.95, SFX ~0.55, `amix normalize=0`; trim/loop to duration; fade 1.4s in/out. See `references/bgm.md`; the same licensed track was used in GEO and PROMPT.
- **AAC 320k**; verify MP4 true peak ≤ -1 dBFS. 192k may overshoot +2.6 dB on impacts. For the BGM mix, use `volume=-1.5dB` + `alimiter=limit=0.80`; the prompt video landed at -1.1 dBFS.
- **Copyright**: use only user-provided licensed audio; do not download commercial tracks or bundle them into the Skill.

## 7. QA

`qa.mjs` should check:

- duration ±0.2s
- 1080×1920
- 30fps
- H.264 / yuv420p
- AAC / 48kHz / stereo
- integrated loudness -16..-12 LUFS
- true peak ≤ -1 dBFS
- no black segment ≥0.3s
- no frozen segment ≥1.5s

Then run the brightness check:

```bash
ffmpeg -i out/final.mp4 -vf "signalstats,metadata=print:file=luma.txt" -an -f null -
node scripts/brightness-check.mjs luma.txt
```

A per-second `YAVG` drop > 3 (excluding intentional scene changes) is a bug. The usual cause is a stale fade/flash time left over from an older duration.

## 8. AI critique loop

Give the reviewer:

- `out/contact-sheet.jpg`
- 3–5 keyframes at scene boundaries
- `script.md`
- `sources.json`
- a rubric prompt (hook, clarity, pacing, hierarchy, legibility, facts, emotion, platform fit, sound)

Require this output shape:

```json
{
  "scores": {},
  "keep": [],
  "fixes": [{"scene":"", "timecode":"", "issue":"", "fix":"", "expected":""}],
  "fact_check": [{"claim":"", "status":"supported|illustrative|needs_softening", "source":""}],
  "audience_simulation": ""
}
```

Max 5 fixes per round. Re-render only affected ranges, then regenerate the contact sheet and compare. After 5 rounds or 2 flat rounds, stop. Human approves facts and final taste.
