#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG = {
  repo: 'rqms40/printing_app',
  branch: 'automation/grid-trello-github-sync',
  snapshot: 'docs/trello/grid-it-team-pm/grid_snapshot.json',
  attachmentRoot: 'docs/trello/grid-it-team-pm',
};

const LABELS = {
  'source:trello': '5319e7',
  'needs-triage': 'fbca04',
  'needs-review': 'd4c5f9',
  'in-progress': '0e8a16',
  'qa': '1d76db',
  'completed': '0e8a16',
  'github-resolved': '5319e7',
  'surface:backend': '1f77b4',
  'surface:admin': '0052cc',
  'surface:mobile': '7b42bc',
  'surface:landing': 'c2e0c6',
  'surface:docs': '0075ca',
};

const SECRET_LINE = /(?:password|passwd|secret|token|api[_-]?key|authorization|bearer|private[_-]?key|firebase-service-account)\s*[:=]/i;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: true, limit: null, shortLinks: new Set() };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--write') opts.dryRun = false;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--limit') opts.limit = Number(args[++i]);
    else if (a === '--short-link') opts.shortLinks.add(args[++i]);
    else if (a === '--snapshot') CONFIG.snapshot = args[++i];
    else if (a === '--repo') CONFIG.repo = args[++i];
    else if (a === '--branch') CONFIG.branch = args[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function ghApi(method, endpoint, body) {
  const args = ['api', '-X', method, endpoint];
  if (body !== undefined) args.push('--input', '-');
  const out = run('gh', args, body === undefined ? undefined : JSON.stringify(body));
  return out ? JSON.parse(out) : null;
}

function ghApiRaw(method, endpoint, body) {
  const args = ['api', '-X', method, endpoint];
  if (body !== undefined) args.push('--input', '-');
  return run('gh', args, body === undefined ? undefined : JSON.stringify(body));
}

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function labelForList(list) {
  const name = String(list || '').toLowerCase();
  if (name.includes('qa')) return 'qa';
  if (name.includes('progress')) return 'in-progress';
  if (name.includes('review')) return 'needs-review';
  if (name.includes('completed')) return 'completed';
  if (name.includes('un-assigned') || name.includes('backlog')) return 'needs-triage';
  return 'needs-triage';
}

function surfaceLabels(card) {
  const text = `${card.name || ''} ${(card.labels || []).join(' ')}`.toLowerCase();
  const labels = new Set();
  if (/api|backend|server|rider api/.test(text)) labels.add('surface:backend');
  if (/admin/.test(text)) labels.add('surface:admin');
  if (/mobile|ui|user|rider\.ui|checkout|deliverytracking|homescreen/.test(text)) labels.add('surface:mobile');
  if (/web|landing|website/.test(text)) labels.add('surface:landing');
  if (/paper|spec|docs|documentation/.test(text)) labels.add('surface:docs');
  return [...labels];
}

function redactDescription(description) {
  const lines = String(description || '').split(/\r?\n/);
  let redacted = false;
  const safe = lines.map((line) => {
    if (SECRET_LINE.test(line)) {
      redacted = true;
      return '[REDACTED: sensitive-looking line omitted]';
    }
    return line;
  }).join('\n').trim();
  return { text: safe, redacted };
}

function checkboxLine(item) {
  const checked = item.state === 'complete' ? 'x' : ' ';
  return `- [${checked}] ${String(item.name || '').replace(/\r?\n/g, ' ')}`;
}

function attachmentMarkdown(card) {
  const lines = [];
  for (const attachment of card.attachments || []) {
    const dl = attachment.download || {};
    if (dl.status === 'downloaded' && dl.relativePath) {
      const repoPath = `${CONFIG.attachmentRoot}/${dl.relativePath}`.replace(/\\/g, '/');
      const urlPath = repoPath.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
      const url = `https://github.com/${CONFIG.repo}/blob/${CONFIG.branch}/${urlPath}`;
      lines.push(`- [${dl.safeName || attachment.name}](${url}) (${dl.mimeType || attachment.mimeType || 'file'}, ${dl.bytes || attachment.bytes || 0} bytes, sha256: \`${dl.sha256 || 'n/a'}\`)`);
    } else if (attachment.isUpload) {
      lines.push(`- ${attachment.name || attachment.id}: not downloaded (${dl.reason || dl.status || 'unknown'})`);
    } else {
      lines.push(`- ${attachment.name || 'External link'}: external Trello link retained in Trello`);
    }
  }
  return lines.length ? lines.join('\n') : '- None';
}

function issueBody(card) {
  const { text, redacted } = redactDescription(card.description);
  const checklistSections = (card.checklists || []).map((cl) => {
    const items = (cl.items || []).map(checkboxLine).join('\n') || '- No checklist items';
    return `### ${cl.name || 'Checklist'}\n${items}`;
  }).join('\n\n') || 'No checklists.';
  const trelloLabels = (card.labels || []).filter(Boolean).join(', ') || 'None';
  const members = (card.members || []).filter(Boolean).join(', ') || 'None';
  return [
    `Trello card: ${card.url}`,
    '',
    `Trello list: **${card.list || 'Unknown'}**`,
    `Trello labels: ${trelloLabels}`,
    `Trello members: ${members}`,
    `Due date: ${card.due || 'None'}`,
    `Due complete: ${card.dueComplete ? 'yes' : 'no'}`,
    '',
    '## Description',
    text || '_No Trello description._',
    redacted ? '\n_One or more sensitive-looking lines were redacted._' : '',
    '',
    '## Checklists',
    checklistSections,
    '',
    '## Attachments',
    attachmentMarkdown(card),
    '',
    `<!-- Trello-Card-ID: ${card.id} -->`,
    `<!-- Trello-ShortLink: ${card.shortLink} -->`,
  ].filter((line) => line !== '').join('\n');
}

function issueLabels(card) {
  const labels = new Set(['source:trello', labelForList(card.list), ...surfaceLabels(card)]);
  for (const label of card.labels || []) {
    const normalized = normalizeLabel(label);
    if (normalized) labels.add(`trello-label:${normalized}`);
  }
  return [...labels];
}

function loadSnapshot() {
  return JSON.parse(fs.readFileSync(CONFIG.snapshot, 'utf8'));
}

function listExistingIssues() {
  const endpoint = `/repos/${CONFIG.repo}/issues?state=all&per_page=100`;
  const all = ghApi('GET', endpoint);
  const map = new Map();
  for (const issue of all || []) {
    if (issue.pull_request) continue;
    const body = issue.body || '';
    const cardId = body.match(/Trello-Card-ID:\s*([a-f0-9]+)/i)?.[1];
    const shortLink = body.match(/Trello-ShortLink:\s*([A-Za-z0-9]+)/)?.[1];
    if (cardId) map.set(cardId, issue);
    if (shortLink) map.set(shortLink, issue);
  }
  return map;
}

function ensureLabels(issueLabelNames, dryRun) {
  const allLabelNames = new Set([...Object.keys(LABELS), ...issueLabelNames]);
  for (const name of allLabelNames) {
    const color = LABELS[name] || 'ededed';
    if (dryRun) continue;
    try {
      ghApiRaw('POST', `/repos/${CONFIG.repo}/labels`, { name, color, description: `GRID Trello sync label: ${name}` });
    } catch (error) {
      if (!String(error.message).includes('already_exists') && !String(error.message).includes('Validation Failed')) throw error;
    }
  }
}


function writeIssue(card, existing, dryRun) {
  const body = issueBody(card);
  const labels = issueLabels(card);
  ensureLabels(labels, dryRun);
  const payload = { title: card.name, body, labels };
  if (dryRun) {
    return { action: existing ? 'would-update' : 'would-create', title: card.name, labels, trello: card.shortLink };
  }
  if (existing) {
    const issue = ghApi('PATCH', `/repos/${CONFIG.repo}/issues/${existing.number}`, payload);
    return { action: 'updated', number: issue.number, title: issue.title, trello: card.shortLink };
  }
  const issue = ghApi('POST', `/repos/${CONFIG.repo}/issues`, payload);
  return { action: 'created', number: issue.number, title: issue.title, trello: card.shortLink };
}

function main() {
  const opts = parseArgs();
  const snapshot = loadSnapshot();
  let cards = snapshot.cards || [];
  if (opts.shortLinks.size) cards = cards.filter((card) => opts.shortLinks.has(card.shortLink));
  if (opts.limit) cards = cards.slice(0, opts.limit);
  const existing = listExistingIssues();
  const results = [];
  for (const card of cards) {
    const found = existing.get(card.id) || existing.get(card.shortLink);
    results.push(writeIssue(card, found, opts.dryRun));
  }
  const summary = results.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ dryRun: opts.dryRun, selectedCards: cards.length, summary, results }, null, 2));
}

main();
