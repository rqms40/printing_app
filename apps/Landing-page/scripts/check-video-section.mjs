import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(scriptDir, '../src/App.tsx'), 'utf8');

assert(app.includes('youtube.com/embed/67Jrr34StKg'), 'Landing page video should use the configured YouTube embed.');
assert(app.includes('playlist=67Jrr34StKg'), 'Looping YouTube video should include the playlist parameter.');
assert(app.includes('title="GRIDGO App Demo Walkthrough"'), 'Video iframe should have an accessible title.');
assert(app.includes('allowFullScreen'), 'Video iframe should allow full-screen playback.');
