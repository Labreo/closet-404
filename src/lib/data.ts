import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { CoronerReport, Site } from '@/types/archive';

export const siteSchema = z.object({
  id: z.string(),
  spine: z.number(),
  url: z.string(),
  title: z.string(),
  category: z.enum(['geocities', 'dotcom', 'oss', 'webring', 'blog', 'netart', 'other']),
  firstCaptured: z.number(),
  lastCaptured: z.number(),
  snapshotTimestamp: z.string(),
  rawUrl: z.string(),
  viewUrl: z.string(),
  liveStatus: z.object({ status: z.number().nullable(), note: z.string() }),
  forensics: z.object({
    title: z.string(),
    metaDescription: z.string(),
    generator: z.string(),
    comments: z.array(z.string()),
    images: z.array(z.object({ src: z.string(), alt: z.string() })),
    links: z.array(z.string()),
    bodyText: z.string(),
  }),
  eulogy: z.string(),
  ghostPersona: z.string(),
  vibeTags: z.array(z.string()),
  accentColor: z.string(),
  generatedBy: z.string(),
});

const coronerSchema = z.record(
  z.string(),
  z.object({
    siteId: z.string(),
    query: z.string(),
    searchedAt: z.string(),
    sources: z.array(
      z.object({
        title: z.string(),
        link: z.string(),
        source: z.string(),
        date: z.string(),
        snippet: z.string(),
      })
    ),
    summary: z.string(),
    generatedBy: z.string(),
  })
);

function readJson(file: string): unknown {
  const full = path.join(process.cwd(), 'data', file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

const sites: Site[] = z.array(siteSchema).parse(readJson('archive.json') ?? []);
const coroner: Record<string, CoronerReport> = coronerSchema.parse(readJson('coroner.json') ?? {});

export function getSites(): Site[] {
  return sites;
}

export function getSite(id: string): Site | undefined {
  return sites.find((s) => s.id === id);
}

export function getCoronerReports(): Record<string, CoronerReport> {
  return coroner;
}

export function getCoronerReport(id: string): CoronerReport | undefined {
  return coroner[id];
}
