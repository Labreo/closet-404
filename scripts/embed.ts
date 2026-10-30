import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Site } from '../src/types/archive';

const ARCHIVE_FILE = path.resolve(process.cwd(), 'data/archive.json');
const EMBEDDINGS_FILE = path.resolve(process.cwd(), 'data/embeddings.json');

async function main() {
  console.log('================================================================');
  console.log('Closet 404 - Embedding Generator (scripts/embed.ts)');
  console.log('================================================================');

  if (!fs.existsSync(ARCHIVE_FILE)) {
    console.error(`Missing archive file: ${ARCHIVE_FILE}`);
    process.exit(1);
  }

  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')) as Site[];
  console.log(`Loaded ${archive.length} sites from archive.json`);

  let pipelineFn: unknown = null;
  try {
    const pkgName = '@huggingface/transformers';
    const moduleObj = (await import(pkgName)) as { pipeline?: unknown };
    pipelineFn = moduleObj.pipeline;
  } catch {
    console.warn(
      '[@huggingface/transformers] Package is not installed in node_modules.'
    );
    console.warn(
      'To enable the optional neural embedding layer, install with:\n  npm i @huggingface/transformers\n'
    );
    console.log(
      'Zero-model keyword search (BM25) in src/lib/search.ts remains fully active.'
    );
    return;
  }

  if (typeof pipelineFn !== 'function') {
    console.warn('Pipeline function not found in @huggingface/transformers');
    return;
  }

  try {
    console.log('Initializing feature-extraction pipeline (Xenova/all-MiniLM-L6-v2)...');
    type PipelineCallable = (
      text: string,
      options: { pooling: string; normalize: boolean }
    ) => Promise<{ data: ArrayLike<number> }>;

    const extractor = (await (pipelineFn as (
      task: string,
      model: string
    ) => Promise<PipelineCallable>)(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    ));

    const embeddings: Record<string, number[]> = {};

    for (let i = 0; i < archive.length; i++) {
      const site = archive[i];
      const textToEmbed = `${site.title}. ${site.vibeTags.join(' ')}. ${site.eulogy} ${site.forensics.bodyText.slice(0, 500)}`;

      console.log(`[${i + 1}/${archive.length}] Embedding ${site.id}...`);
      const output = await extractor(textToEmbed, {
        pooling: 'mean',
        normalize: true,
      });

      embeddings[site.id] = Array.from(output.data);
    }

    const payload = {
      model: 'Xenova/all-MiniLM-L6-v2',
      embeddings,
    };

    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Saved embeddings to ${EMBEDDINGS_FILE}`);
  } catch (err) {
    console.error(
      'Failed generating embeddings:',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

void main();
