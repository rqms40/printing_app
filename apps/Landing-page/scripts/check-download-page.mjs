import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const source = resolve(scriptDir, '..', 'src');
const main = readFileSync(resolve(source, 'main.tsx'), 'utf8');
const app = readFileSync(resolve(source, 'App.tsx'), 'utf8');
const links = readFileSync(resolve(source, 'utils', 'landingLinks.ts'), 'utf8');
const downloadPagePath = resolve(source, 'DownloadPage.tsx');

assert(
  main.includes('<Route path="/download" element={<DownloadPage />} />'),
  'The landing app should expose a dedicated /download route.',
);
assert(
  app.includes('to="/download"'),
  'The landing Download navigation should route to /download.',
);
assert(
  links.includes("const currentReleaseVersion = 'v1.12.4';"),
  'Release metadata should name the current v1.12.4 beta.',
);
assert(
  existsSync(downloadPagePath),
  'The landing app should contain the download page component.',
);

const page = readFileSync(downloadPagePath, 'utf8');
assert(page.includes('GRIDGO Android Beta'), 'Download page should clearly label the beta release.');
assert(page.includes('GRIDGO-v1.12.4.apk'), 'Download page should offer the pinned v1.12.4 APK.');
assert(page.includes('GRIDGO-latest.apk'), 'Download page should offer the current latest APK.');
assert(page.includes('Android only'), 'Download page should state platform availability accurately.');
assert(!page.includes('GitHub'), 'Download page should not display GitHub branding.');
assert(!page.includes('github.com'), 'Download page should not link visitors to GitHub.');
assert(!links.includes('github.com'), 'Landing download helpers should use first-party download paths.');
assert(links.includes("return `/downloads/${assetName}`;"), 'Latest APK should resolve through /downloads on the landing domain.');
assert(links.includes("return `/downloads/${assetName}`;"), 'Versioned APK should resolve through /downloads on the landing domain.');