#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const legacyRole = 'dri' + 'ver';
const legacyRolePattern = new RegExp(`\\b${legacyRole}s?\\b`, 'i');
const legacyBrand = 'GR' + 'ID';
const legacyBrandPattern = new RegExp(`\\b${legacyBrand}\\b`, 'g');
const lowerLegacyBrand = legacyBrand.toLowerCase();
const legacyBrandVariantPatterns = [
  new RegExp(`${lowerLegacyBrand}print`, 'i'),
  new RegExp(`${lowerLegacyBrand}\\.ph`, 'i'),
  new RegExp(`com\\.${lowerLegacyBrand}print`, 'i'),
  new RegExp(`${lowerLegacyBrand}_go`, 'i'),
  new RegExp(`${lowerLegacyBrand}-go`, 'i'),
  new RegExp(`${lowerLegacyBrand} go`, 'i'),
];

const excludedPathPatterns = [
  /(^|\/)\.git\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.dart_tool\//,
  /(^|\/)\.serena\//,
  /(^|\/)screenshots-for-agents\//,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pubspec\.lock$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)scripts\/terminology-check\.mjs$/,
];

const likelyBinaryExtensions = new Set([
  '.a',
  '.apk',
  '.bin',
  '.gif',
  '.glb',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.keystore',
  '.mp3',
  '.png',
  '.ttf',
  '.webp',
]);

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((path) => !excludedPathPatterns.some((pattern) => pattern.test(path)));
}

function isText(buffer) {
  return !buffer.includes(0);
}

function hasLikelyBinaryExtension(path) {
  const lower = path.toLowerCase();
  return [...likelyBinaryExtensions].some((ext) => lower.endsWith(ext));
}

function pdfAsciiStrings(buffer) {
  return Array.from(buffer.toString('latin1').matchAll(/[\x20-\x7e]{4,}/g), (match) => match[0]);
}

function shouldScanBinaryMetadata(path) {
  return /\.(glb|pdf|png)$/i.test(path);
}

const findings = [];

for (const path of trackedFiles()) {
  if (
    legacyRolePattern.test(path) ||
    legacyBrandPattern.test(path) ||
    legacyBrandVariantPatterns.some((pattern) => pattern.test(path))
  ) {
    findings.push(`${path}: path contains legacy terminology`);
  }

  let buffer;
  try {
    buffer = readFileSync(path);
  } catch {
    continue;
  }

  const lines = shouldScanBinaryMetadata(path)
    ? pdfAsciiStrings(buffer)
    : isText(buffer) && !hasLikelyBinaryExtension(path)
      ? buffer.toString('utf8').split(/\r?\n/)
      : [];

  for (const [index, line] of lines.entries()) {
    if (
      legacyRolePattern.test(line) ||
      legacyBrandPattern.test(line) ||
      legacyBrandVariantPatterns.some((pattern) => pattern.test(line))
    ) {
      findings.push(`${path}:${index + 1}: ${line.trim()}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Terminology check failed with ${findings.length} finding(s):`);
  for (const finding of findings.slice(0, 200)) {
    console.error(`- ${finding}`);
  }
  if (findings.length > 200) {
    console.error(`... ${findings.length - 200} more finding(s) omitted`);
  }
  process.exit(1);
}

console.log('Terminology check passed.');
