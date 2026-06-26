import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(scriptDir, '../src/App.tsx'), 'utf8');
const links = readFileSync(resolve(scriptDir, '../src/utils/landingLinks.ts'), 'utf8');

assert(
  links.includes('defaultCommunityUrl'),
  'Landing links should define a single default community URL.',
);
assert(
  links.includes('VITE_GRID_COMMUNITY_URL'),
  'Landing community URL should be overrideable with VITE_GRID_COMMUNITY_URL.',
);
assert(
  links.includes('communityUrl'),
  'landingLinks() should expose the resolved community URL.',
);
assert(
  app.includes('communityUrl'),
  'Beta section should read the configured community URL.',
);
assert(
  app.includes('Join GRID Community'),
  'Landing page should include the GRID Community CTA.',
);
assert(
  app.includes('href={communityUrl}'),
  'Landing page community CTA should use the configured URL.',
);
assert(
  app.includes('target="_blank"'),
  'Landing page community CTA should open externally.',
);
