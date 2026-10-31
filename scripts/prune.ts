import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Site } from '../src/types/archive';

// Removes curated-out entries from data/archive.json and renumbers spines.
// Usage: npx tsx scripts/prune.ts <id> [id...]

const ARCHIVE_FILE = path.resolve(process.cwd(), 'data/archive.json');
const RAW_DIR = path.resolve(process.cwd(), 'data/raw');

const drop = new Set(process.argv.slice(2));
if (drop.size === 0) {
  console.error('Usage: npx tsx scripts/prune.ts <id> [id...]');
  process.exit(1);
}

const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')) as Site[];
const kept = archive.filter((s) => !drop.has(s.id));
kept.forEach((s, i) => {
  s.spine = i + 1;
});
fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(kept, null, 2) + '\n', 'utf-8');

for (const id of drop) {
  const raw = path.join(RAW_DIR, `${id}.html`);
  if (fs.existsSync(raw)) fs.unlinkSync(raw);
}

console.log(`removed ${archive.length - kept.length}, kept ${kept.length}`);
