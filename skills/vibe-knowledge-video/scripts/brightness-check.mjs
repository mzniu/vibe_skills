#!/usr/bin/env node
// Usage:
//   ffmpeg -i out/final.mp4 -vf "signalstats,metadata=print:file=luma.txt" -an -f null -
//   node scripts/brightness-check.mjs luma.txt [threshold=3]
//
// Flags per-second average-luma drops larger than the threshold.
// Intentional scene changes can trip it; inspect the timestamps before fixing.

import fs from 'node:fs';

const file = process.argv[2] || 'luma.txt';
const threshold = Number(process.argv[3] ?? 3);

if (!fs.existsSync(file)) {
  console.error(`No ${file}. Generate it with:`);
  console.error('  ffmpeg -i out/final.mp4 -vf "signalstats,metadata=print:file=luma.txt" -an -f null -');
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const frames = [];
let cur = null;

for (const line of lines) {
  let m = line.match(/pts_time:([\d.]+)/);
  if (m) { cur = { t: Number(m[1]) }; continue; }
  m = line.match(/YAVG=([\d.]+)/);
  if (m && cur) { cur.y = Number(m[1]); continue; }
  m = line.match(/YMAX=([\d.]+)/);
  if (m && cur) {
    cur.max = Number(m[1]);
    frames.push(cur);
    cur = null;
  }
}

if (!frames.length) {
  console.error('No YAVG/YMAX frames parsed. Check that signalstats metadata was written.');
  process.exit(1);
}

const seconds = Math.floor(frames[frames.length - 1].t) + 1;
const per = [];
for (let s = 0; s < seconds; s++) {
  const bucket = frames.filter(f => f.t >= s && f.t < s + 1);
  per.push(bucket.length
    ? {
        y: bucket.reduce((a, f) => a + f.y, 0) / bucket.length,
        max: Math.max(...bucket.map(f => f.max ?? 0))
      }
    : { y: 0, max: 0 });
}

console.log('sec   YAVG   dYAVG   YMAX');
const bad = [];
for (let s = 0; s < per.length; s++) {
  const d = s ? per[s].y - per[s - 1].y : 0;
  console.log(
    String(s).padStart(3),
    per[s].y.toFixed(1).padStart(6),
    d.toFixed(1).padStart(7),
    String(Math.round(per[s].max)).padStart(6)
  );
  if (s > 0 && d < -threshold) bad.push({ s, d });
}

if (bad.length) {
  console.error(`\nSuspicious drops (>${threshold} luma):`);
  for (const b of bad) console.error(`  ${b.s}s: ${b.d.toFixed(1)}`);
  console.error('Inspect the frames around these times. If the drop is not an intentional scene change, search for stale fade/flash times.');
  process.exitCode = 2;
} else {
  console.log('\nNo per-second drop above the threshold.');
}
