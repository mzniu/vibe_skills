# BGM Workflow (user-provided licensed track)

The track used in this project is **《千年之后（氛围版）》by 艾拉拉/Luv4** — a commercial track. Do **not** download or redistribute it. The user supplies `audio/bgm-source.mp3` and confirms usage rights. The Skill documents the mixing workflow only; it does not bundle the audio.

## Policy

- Use the user's BGM as the **music bed**; do not stack a synthesized pad/melody under it.
- Generate an **SFX-only** track: `node audio.mjs --sfx-only` → `audio/sfx.wav`.
- Mix BGM **0.95** + SFX **0.55** with `amix normalize=0`.
- Trim/loop BGM to the video duration; fade 1.4s in/out.
- Two-pass loudnorm → -14 LUFS; then `volume=-1.5dB`, `alimiter=limit=0.80`.
- Encode AAC **320k**; verify the **MP4** true peak ≤ -1 dBFS.
- The same track has been used in both the GEO 38s and PROMPT 38s videos.

## Commands

```powershell
# 1) SFX only (no pad/plucks/shimmer)
node audio.mjs --sfx-only

# 2) Mix BGM + SFX, normalize, write audio/soundtrack_final.wav
node mix-bgm.mjs --no-remux

# 3) Encode with the mixed audio
ffmpeg -y -framerate 30 -i frames/%05d.png -i audio/soundtrack_final.wav `
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" `
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p `
  -c:a aac -b:a 320k -ar 48000 -shortest out/final.mp4

# 4) QA
node qa.mjs
```

To choose a different section of the track:

```powershell
node mix-bgm.mjs --offset=40 --tempo=0.9
```

## Why BGM-forward

A full synth soundtrack (pad + shimmer) plus a licensed BGM produces two music beds. The result is a drone that masks the BGM melody; viewers report “no BGM”. Removing the pad and keeping only impacts, ticks, whooshes, and chimes lets the BGM read clearly.

## Copyright

- Do not download the trend track from NetEase/QQ/Douyin.
- Do not commit the audio to a public repo or bundle it into a Skill.
- Ask the user for a licensed file; keep it in the project's `audio/` folder.
- If the user has no license, use an original synth track or a royalty-free track with a similar vibe.
