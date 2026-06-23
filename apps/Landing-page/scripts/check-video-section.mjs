import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(scriptDir, '../src/App.tsx'), 'utf8');
const videoPath = resolve(scriptDir, '../public/demo.mp4');
const posterPath = resolve(scriptDir, '../public/GRIDGO WEBSITE.png');

assert(existsSync(videoPath), 'Landing page video asset should exist at public/demo.mp4.');
assert(statSync(videoPath).size > 1024, 'Landing page video asset should not be empty.');
assert(existsSync(posterPath), 'Landing page video should have a poster fallback image.');

const mp4Header = readFileSync(videoPath).subarray(4, 12).toString('ascii');
assert(mp4Header.includes('ftyp'), 'Landing page video asset should be an MP4 file.');

assert(app.includes('<source src="/demo.mp4" type="video/mp4" />'), 'Video should declare an MP4 source type.');
assert(app.includes('poster="/GRIDGO WEBSITE.png"'), 'Video should display a poster while media loads.');
assert(app.includes('preload="metadata"'), 'Video should avoid blocking on the full 38 MB asset before rendering.');
assert(app.includes('onError={() => setHasVideoError(true)}'), 'Video should expose a visible fallback on load error.');
assert(app.includes('Video preview unavailable'), 'Video fallback should explain the unavailable preview state.');
