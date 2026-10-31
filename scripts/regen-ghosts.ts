import * as fs from 'node:fs';
import * as path from 'node:path';
import { callLlmForSite } from '../src/lib/pipeline';
import type { Site } from '../src/types/archive';

// Re-runs only the open-weight LLM step over the forensics already scraped into
// data/archive.json. No archive.org requests are made. Usage:
//   npx tsx --env-file=.env.local scripts/regen-ghosts.ts [--only id1,id2] [--force] [--concurrency 4]

const ARCHIVE_FILE = path.resolve(process.cwd(), 'data/archive.json');

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')) as Site[];
  const only = argValue('--only')?.split(',');
  const force = process.argv.includes('--force');
  const primary = process.env.LLM_MODEL ?? '';
  const concurrency = Number(argValue('--concurrency') ?? '1');
  const report: { id: string; result: string }[] = [];

  const queue = archive.filter((site) => {
    if (only && !only.includes(site.id)) return false;
    if (!force && site.generatedBy.startsWith('gemma')) {
      report.push({ id: site.id, result: `kept (${site.generatedBy})` });
      return false;
    }
    return true;
  });

  async function worker(): Promise<void> {
    for (let site = queue.shift(); site; site = queue.shift()) {
      await regenerate(site);
    }
  }

  async function regenerate(site: Site): Promise<void> {
    const started = performance.now();
    try {
      const out = await callLlmForSite(
        site.url,
        site.forensics,
        site.firstCaptured,
        site.lastCaptured,
        site.snapshotTimestamp
      );
      site.title = out.title;
      site.category = out.category;
      site.eulogy = out.eulogy;
      site.ghostPersona = out.ghostPersona;
      site.vibeTags = out.vibeTags;
      site.accentColor = out.accentColor;
      site.generatedBy = out.model;
      // Write after every site so an interrupted run keeps its progress.
      fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2) + '\n', 'utf-8');
      const ms = Math.round(performance.now() - started);
      report.push({ id: site.id, result: `ok ${out.model} ${ms}ms` });
      console.log(`[ok] ${site.id} (${out.model}, ${ms}ms): ${out.eulogy}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      report.push({ id: site.id, result: `FAILED ${reason.slice(0, 120)}` });
      console.log(`[fail] ${site.id}: ${reason}`);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  console.log(`\nprimary model: ${primary}`);
  console.table(report);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
