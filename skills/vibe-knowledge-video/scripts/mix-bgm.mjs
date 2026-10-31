import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const args = new Map(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const DUR = Number(args.get('duration') ?? 38);
const VIDEO = path.resolve(args.get('video') ?? 'out/final.mp4');
const BGM_VOL = Number(args.get('bgm') ?? 0.95);
const SFX_VOL = Number(args.get('sfx') ?? 0.55);

function run(cmd, argv, label) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`[bgm] ${label} failed`);
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  return r.stderr || '';
}

const candidates = [
  'audio/bgm-source.mp3', 'audio/bgm-source.wav', 'audio/bgm-source.m4a',
  'audio/bgm-source.flac', 'audio/bgm-source.aac', 'audio/bgm-source.ogg'
];
const bgm = candidates.map(p => path.resolve(p)).find(p => fs.existsSync(p));
if (!bgm) {
  console.error('[bgm] Put a licensed track at audio/bgm-source.*');
  process.exit(1);
}

const sfxPath = path.resolve('audio/sfx.wav');
const sfx = fs.existsSync(sfxPath) ? sfxPath : path.resolve('audio/soundtrack.wav');
const raw = path.resolve('audio/mix_raw.wav');
const final = path.resolve('audio/soundtrack_final.wav');

const tempo = Number(args.get('tempo') ?? 1.0);
const offset = Number(args.get('offset') ?? 0);

const bgmChain = [
  tempo !== 1 ? `atempo=${tempo}` : null,
  `volume=${BGM_VOL}`,
  'afade=t=in:st=0:d=1.4',
  `afade=t=out:st=${DUR - 1.4}:d=1.4`
].filter(Boolean).join(',');

const filter = [
  `[0:a]${bgmChain}[bgm]`,
  `[1:a]volume=${SFX_VOL}[sfx]`,
  '[bgm][sfx]amix=inputs=2:duration=longest:normalize=0[mix]'
].join(';');

console.log(`[bgm] source: ${bgm}`);
console.log(`[bgm] tempo: ${tempo}x, offset: ${offset}s, duration: ${DUR}s`);

run('ffmpeg', [
  '-y', '-hide_banner',
  '-ss', String(offset),
  '-stream_loop', '-1', '-i', bgm,
  '-i', sfx,
  '-filter_complex', filter,
  '-map', '[mix]',
  '-t', String(DUR),
  '-ar', '48000',
  raw
], 'mix');

const pass1 = run('ffmpeg', [
  '-hide_banner', '-nostats', '-i', raw,
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
  '-f', 'null', '-'
], 'measure');
const objs = pass1.match(/\{[\s\S]*?\}/g) || [];
let m;
try { m = JSON.parse(objs[objs.length - 1]); } catch (e) {
  console.error('[bgm] failed to parse loudnorm JSON');
  process.exit(1);
}

const normFilter = [
  `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  'volume=-1.5dB',
  'alimiter=limit=0.80:attack=5:release=50'
].join(',');

run('ffmpeg', [
  '-y', '-hide_banner', '-i', raw,
  '-af', normFilter,
  '-ar', '48000',
  final
], 'normalize');

console.log(`[bgm] wrote ${final}`);
console.log(`[bgm] measured mix: ${m.input_i} LUFS, TP ${m.input_tp} dBTP`);

if (!args.has('no-remux') && fs.existsSync(VIDEO)) {
  const tmp = VIDEO.replace(/\.mp4$/i, '-bgm.mp4');
  run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', VIDEO,
    '-i', final,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart',
    tmp
  ], 'remux');
  fs.copyFileSync(tmp, VIDEO);
  fs.unlinkSync(tmp);
  console.log(`[bgm] remuxed audio into ${VIDEO}`);
}
