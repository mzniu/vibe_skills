# Production Pitfalls (real failures)

These are bugs that survived visual spot-checks. Use them as a regression checklist after any timeline or audio change.

## 1. Stale end-fade becomes a persistent dark overlay

**Symptom:** the whole image suddenly darkens in the 20s range and stays dark.

**Cause:** a 20s cut became 38s, but `postProcess` still had:

```js
if (t > 19.55) {
  const a = smoothstep(19.55, 20.0, t);
  ctx.fillStyle = `rgba(0,0,0,${a * 0.35})`;
  ctx.fillRect(0, 0, W, H);
}
```

For `t > 20`, `a = 1`, so the 35% black overlay **never goes away**.

**Diagnosis:** per-second `YAVG` via `signalstats` showed 31.9 → 26.6 at 23s and stayed ~26.5. Frame-level `YMAX` dropped 234 → 174 over 0.37s.

**Fix:** move the fade to the new content end (`contentDuration - 0.45`), then re-render **from the old fade start to the end** — not just the visible fade window.

## 2. Absolute vs content-local time

After adding a 3s intro, pass `c = T - INTRO` to scenes. Text helpers must use a content-local clock (`CT`), not the absolute `T`. Otherwise every caption appears 3s early/late relative to the visuals.

**Test:** render a frame at `T = INTRO + 0.5`; the content scene should be at its local 0.5s state.

## 3. Scrims drawn after copy

If the bottom gradient scrim is drawn after the scene copy, it dims the captions. Draw scrims **before** the scene layer, then draw HUD and copy on top.

## 4. Particle trails wrap across the route

A trail sampled from `s - trail` to `s` can wrap from the route end to the route start, drawing a fake straight line across the whole map.

**Fix:** skip the segment when the older sample is negative:

```js
if (d2 < 0) continue;
```

## 5. Full-screen crossfades double-expose

Crossfading chat card → split panels, or pipeline → comparison, shows both UIs at once (text over text). Use a **hard cut** for full-screen scene changes; reserve short crossfades for small overlapping elements.

## 6. BGM masked by a synth pad

Mixing a licensed BGM with a full synthesized soundtrack (pad + shimmer + BGM) at similar levels produces a drone; the BGM melody disappears.

**Fix:** regenerate an **SFX-only** track; mix BGM at 0.95 and SFX at 0.55. The BGM should be the music; the synth is only accents.

## 7. AAC true-peak overshoot

A WAV limited to -1.0 dBFS became **+1.6 dBFS** after 192k AAC on impact-heavy content. 320k brought it to -1.0 dBFS.

**Rule:** encode at 320k; verify the **MP4** true peak, not the WAV. If still over, lower by 0.5–1.0 dB and re-check.

## 8. Citation chips overlap body text

Placing chips at `abY + 278` inside a 336px bubble overlapped the last answer line. Move chips below the bubble (e.g., `abY + 360`) or increase the card height.

## 9. Background render jobs die with the session

Long `render.mjs` runs in a background shell may be killed when the session exits. Check the last frame (`frames/00104.png`), resume from `last + 1`, and run long chunks in the foreground. Never assume a background job completed.

## 10. Copyright and factual overreach

- The trend BGM 《千年之后（氛围版）》 (艾拉拉/Luv4) is commercial. Do not download it; require a licensed file.
- “GEO boosts visibility by up to 40%” is a benchmark result, not a guarantee. Do not put it on screen without that caveat.
- “24 sources → 3 citations” is illustrative; label it or keep it as a diagram, not a measured claim.
- Fictional brands (A/B/C) must stay fictional.

## 11. Hard cuts still need a brightness check

A hard cut between a bright pipeline and a dark comparison page can drop `YAVG` by ~3 even when intentional. Either accept it as a scene change or add a short light sweep/flash to mask it. Check per-second luma after the cut.

## 12. Source counter color is not a global exposure change

Changing the HUD number from amber to green can look like a “dimming” in a contact sheet, but it only affects a small region. Do not compensate with a global brightness filter; verify with full-frame `YAVG/YMAX`.
