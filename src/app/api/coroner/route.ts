import { z } from 'zod';
import { getCoronerReport, getSite } from '@/lib/data';
import { holdInquest } from '@/lib/coroner';
import { allowRequest, clientIp } from '@/lib/ratelimit';
import type { CoronerReport } from '@/types/archive';

const bodySchema = z.object({
  site: z.object({
    id: z.string().min(1).max(200),
    url: z.string().min(1).max(300),
    title: z.string().max(300),
    firstCaptured: z.number(),
    lastCaptured: z.number(),
  }),
});

const cache = new Map<string, CoronerReport>();

/** Live inquest for sites without a baked report (e.g. resurrected ones). */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Invalid inquest request.', { status: 400 });
  const { site: input } = parsed.data;

  const baked = getCoronerReport(input.id);
  if (baked) return Response.json(baked);
  const cached = cache.get(input.id);
  if (cached) return Response.json(cached);

  if (!process.env.SERPAPI_API_KEY) {
    return new Response('Live inquests need SERPAPI_API_KEY on the server.', { status: 501 });
  }
  if (!allowRequest('coroner', clientIp(request.headers), 4, 40)) {
    return new Response('The coroner is busy. Try again in a few minutes.', { status: 429 });
  }

  const known = getSite(input.id);
  const site = known ?? {
    ...input,
    spine: 0,
    category: 'other' as const,
    snapshotTimestamp: '',
    rawUrl: '',
    viewUrl: '',
    liveStatus: { status: null, note: '' },
    forensics: { title: '', metaDescription: '', generator: '', comments: [], images: [], links: [], bodyText: '' },
    eulogy: '',
    ghostPersona: '',
    vibeTags: [],
    accentColor: '#ff9e00',
    generatedBy: '',
  };

  try {
    const report = await holdInquest(site, AbortSignal.timeout(150_000));
    cache.set(input.id, report);
    return Response.json(report);
  } catch (err) {
    return new Response(`Inquest failed: ${err instanceof Error ? err.message.slice(0, 160) : 'unknown error'}`, {
      status: 502,
    });
  }
}
