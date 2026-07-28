#!/usr/bin/env node
// Generate a structured policy.json from the canonical legal/privacy-policy.md
// (the single source of truth for the wording) and write it into both apps so
// each stays self-contained. Run: `node legal/generate.mjs`.
//
// The .md wording is NEVER edited here — this only reshapes it into JSON:
//   { version, lastUpdated, contactEmail, placeholders, sections: [
//       { number, heading, blocks: [ {type, ...} ] } ] }
// Sections keep their source numbers, headings and order exactly.
//
// No dependencies — plain Node, so it runs in any of the three app toolchains.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const SOURCE = join(here, 'privacy-policy.md');
const OUTPUTS = [
  join(repoRoot, 'mobile', 'assets', 'legal', 'policy.json'),
  join(repoRoot, 'admin', 'src', 'features', 'legal', 'policy.json'),
];

const PLACEHOLDER_RE = /\{\{([A-Z_]+)\}\}/g;

function parseMeta(lines) {
  const meta = { version: '', lastUpdated: '', contactEmail: '' };
  for (const line of lines) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key.startsWith('last updated')) meta.lastUpdated = val;
    else if (key === 'version') meta.version = val;
    else if (key.startsWith('contact')) meta.contactEmail = val;
  }
  return meta;
}

// Collect every {{PLACEHOLDER}} token in the source so the apps have the full
// set in one object (values are empty until filled in the .md).
function collectPlaceholders(text) {
  const set = {};
  let m;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) set[m[1]] = '';
  return set;
}

// Split the body into sections on "## N. Heading" and classify each block as a
// paragraph, a bullet list, or a blockquote (the §8 "FILL THIS IN" note).
function parseSections(body) {
  const sections = [];
  let current = null;
  let para = [];
  let bullets = [];

  const flushPara = () => {
    if (para.length) {
      current.blocks.push({ type: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      current.blocks.push({ type: 'list', items: bullets.slice() });
      bullets = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushBullets();
  };

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (heading) {
      if (current) {
        flushAll();
        sections.push(current);
      }
      current = { number: Number(heading[1]), heading: heading[2].trim(), blocks: [] };
      continue;
    }
    if (!current) continue; // skip the meta header region

    if (line.startsWith('> ')) {
      flushAll();
      current.blocks.push({ type: 'note', text: line.replace(/^>\s+/, '').trim() });
      continue;
    }
    if (line.startsWith('- ')) {
      flushPara();
      bullets.push(line.replace(/^-\s+/, '').trim());
      continue;
    }
    if (line === '') {
      flushAll();
      continue;
    }
    flushBullets();
    para.push(line);
  }
  if (current) {
    flushAll();
    sections.push(current);
  }
  return sections;
}

const md = readFileSync(SOURCE, 'utf8');
const headerRegion = md.split(/^## /m)[0]; // everything before the first section
const meta = parseMeta(headerRegion.split('\n'));

const policy = {
  ...meta,
  placeholders: collectPlaceholders(md),
  sections: parseSections(md),
};

const json = JSON.stringify(policy, null, 2) + '\n';
for (const out of OUTPUTS) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log('wrote', out);
}
console.log(`sections: ${policy.sections.length}, placeholders: ${Object.keys(policy.placeholders).length}`);
