import { z } from 'zod';
import { chat } from './llm';
import type { CoronerReport, CoronerSource, Site } from '../types/archive';

/** The domain a site lived on, without www or path (geocities.com/Area51/1019 -> geocities.com). */
export function hostOf(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();
}

export function coronerQuery(site: Site): string {
  return `"${hostOf(site.url)}" shut down history`;
}

interface SerpOrganic {
  title?: string;
  link?: string;
  source?: string;
  date?: string;
  snippet?: string;
}

/** One live Google search through SerpApi. Only results with absolute links are kept. */
export async function searchTheLiving(query: string, signal?: AbortSignal): Promise<CoronerSource[]> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) throw new Error('SERPAPI_API_KEY is not set');
  const url = `https://serpapi.com/search.json?engine=google&num=10&hl=en&q=${encodeURIComponent(query)}&api_key=${key}`;
  const attemptSignal = () => (signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000));
  let res = await fetch(url, { signal: attemptSignal() });
  for (let attempt = 1; attempt <= 2 && (res.status === 429 || res.status >= 500); attempt++) {
    await new Promise((r) => setTimeout(r, 3000 * attempt));
    res = await fetch(url, { signal: attemptSignal() });
  }
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const data = (await res.json()) as { organic_results?: SerpOrganic[]; error?: string };
  if (data.error) throw new Error(`SerpApi: ${data.error}`);
  return (data.organic_results ?? [])
    .filter((r) => r.link?.startsWith('http') && r.title && r.snippet)
    .slice(0, 6)
    .map((r) => ({
      title: r.title ?? '',
      link: r.link ?? '',
      source: r.source ?? hostOf(r.link ?? ''),
      date: r.date ?? '',
      snippet: r.snippet ?? '',
    }));
}

const summarySchema = z.object({ summary: z.string().min(10) });

/** Gemma writes the cause of death using only the numbered search results, citing them as [n]. */
export async function writeCoronerSummary(site: Site, sources: CoronerSource[]): Promise<{ summary: string; model: string }> {
  let model = process.env.LLM_MODEL ?? 'unknown';
  if (sources.length === 0) {
    return { summary: 'Cause of death unrecorded. A web search found nobody writing about how it ended.', model };
  }
  const evidence = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.source}${s.date ? `, ${s.date}` : ''}): ${s.snippet}`)
    .join('\n');
  const reply = await chat({
    messages: [
      {
        role: 'system',
        content:
          'You are the coroner of Closet 404, an archive of dead websites. Use ONLY the numbered search results. Cite every claim with [n]. If the results do not say how the site ended, say "Cause of death unrecorded." Do not use outside knowledge. Reply with JSON {"summary": string}.',
      },
      {
        role: 'user',
        content: `SITE: ${site.title} (${site.url}), first captured ${site.firstCaptured}, last captured ${site.lastCaptured}.
SEARCH RESULTS:
${evidence}

Write the coroner's finding in 2 or 3 plain sentences: what happened to this website and when, with [n] citations.`,
      },
    ],
    json: true,
    temperature: 0.2,
    maxTokens: 400,
    timeoutMs: 120_000,
    onModel: (m) => {
      model = m;
    },
  });
  const parsed = summarySchema.parse(JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)));
  return { summary: parsed.summary.trim(), model };
}

export async function holdInquest(site: Site, signal?: AbortSignal): Promise<CoronerReport> {
  const query = coronerQuery(site);
  const sources = await searchTheLiving(query, signal);
  const { summary, model } = await writeCoronerSummary(site, sources);
  return {
    siteId: site.id,
    query,
    searchedAt: new Date().toISOString(),
    sources,
    summary,
    generatedBy: model,
  };
}
