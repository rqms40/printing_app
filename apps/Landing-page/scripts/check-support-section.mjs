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

assert(app.includes('GRIDGO Ticketing Support'), 'Support section should use the production ticketing support label.');
assert(app.includes('Submit a Ticket Now'), 'Support section should route users into the ticket flow.');
assert(app.includes('Human-led responses'), 'Support section should set expectations for human-led support.');
assert(app.includes('Fast resolution'), 'Support section should include the current support promise.');

const supportLinks = app.match(/to="\/support"/g) ?? [];
assert(supportLinks.length >= 1, 'The support CTA should route to /support.');
assert(
  main.includes('<Route path="/support" element={<SupportPage />} />'),
  'The /support route should render the support ticket page.',
);
