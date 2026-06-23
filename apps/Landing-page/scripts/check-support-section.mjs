import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(scriptDir, '../src/App.tsx'), 'utf8');
const main = readFileSync(resolve(scriptDir, '../src/main.tsx'), 'utf8');

assert(!app.includes('Number Hub'), 'Support section should not use the placeholder "Number Hub" label.');
assert(!app.includes('Call Support Hub'), 'Support CTA should not imply a missing call hub.');
assert(!app.includes('GRIDGO AI assistant'), 'Support section should not promise an unavailable AI assistant.');
assert(!app.includes('AI handles common questions'), 'Support section should not promise unavailable live-chat automation.');

assert(app.includes('Support Center'), 'Support section should use the production Support Center label.');
assert(app.includes('Message Support'), 'Support section should present messaging as a support-ticket flow.');
assert(app.includes('Open Support Center'), 'Primary support CTA should open the support center.');
assert(app.includes('Start Support Ticket'), 'Messaging CTA should start a support ticket.');

const supportLinks = app.match(/to="\/support"/g) ?? [];
assert(supportLinks.length >= 2, 'Both support CTAs should route to /support.');
assert(
  main.includes('<Route path="/support" element={<SupportPage />} />'),
  'The /support route should render the support ticket page.',
);
