import * as fs from 'node:fs';
import * as path from 'node:path';
import { coronerQuery, searchTheLiving, writeCoronerSummary } from '../src/lib/coroner';
import type { CoronerReport, CoronerSource, Site } from '../src/types/archive';

// Bakes data/coroner.json: one SerpApi web search per distinct domain, then an
// open-weight model summary that may only cite those results. Resumable.
// Usage: npx tsx --env-file=.env.local scripts/coroner.ts [--force]

const ARCHIVE_FILE = path.resolve(process.cwd(), 'data/archive.json');
const CORONER_FILE = path.resolve(process.cwd(), 'data/coroner.json');

async function main(): Promise<void> {
  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')) as Site[];
  const force = process.argv.includes('--force');
  const reports: Record<string, CoronerReport> =
    !force && fs.existsSync(CORONER_FILE)
      ? (JSON.parse(fs.readFileSync(CORONER_FILE, 'utf-8')) as Record<string, CoronerReport>)
      : {};
  const searches = new Map<string, CoronerSource[]>();
  for (const r of Object.values(reports)) searches.set(r.query, r.sources);

  const queue = archive.filter((site) => !reports[site.id]);
  // Search sequentially (cheap, cached per domain); summaries run 3 at a time.
  for (const site of queue) {
    const query = coronerQuery(site);
    if (searches.has(query)) continue;
    try {
      const found = await searchTheLiving(query);
      searches.set(query, found);
      console.log(`[search] ${query}: ${found.length} results`);
    } catch (err) {
      console.log(`[search fail] ${site.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  async function worker(): Promise<void> {
    for (let site = queue.shift(); site; site = queue.shift()) await examine(site);
  }

  async function examine(site: Site): Promise<void> {
    const query = coronerQuery(site);
    try {
      const sources = searches.get(query);
      if (!sources) throw new Error('search failed');
      const { summary, model } = await writeCoronerSummary(site, sources);
      reports[site.id] = { siteId: site.id, query, searchedAt: new Date().toISOString(), sources, summary, generatedBy: model };
      fs.writeFileSync(CORONER_FILE, JSON.stringify(reports, null, 2) + '\n', 'utf-8');
      console.log(`[ok] ${site.id} (${sources.length} sources, ${model}): ${summary}`);
    } catch (err) {
      console.log(`[fail] ${site.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  console.log(`\n${Object.keys(reports).length}/${archive.length} reports, ${searches.size} distinct searches`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
