import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resurrectUrl } from '@/lib/pipeline';
import type { Site } from '@/types/archive';

// In-memory cache by normalized URL (Not persisted to disk)
const urlCache = new Map<string, Site>();

// Server-wide concurrency lock (one request at a time server-wide)
let isProcessingServerWide = false;

const resurrectRequestSchema = z.object({
  url: z.string().trim().min(1, 'URL is required'),
});

function normalizeUrlKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  const parsed = resurrectRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid URL' },
      { status: 400 }
    );
  }

  const rawUrl = parsed.data.url;
  const normalizedKey = normalizeUrlKey(rawUrl);

  // Return immediately if in memory cache
  const cachedSite = urlCache.get(normalizedKey);
  if (cachedSite) {
    return NextResponse.json({ site: cachedSite, cached: true });
  }

  // Server-wide concurrency limit: one request at a time server-wide
  if (isProcessingServerWide) {
    return NextResponse.json(
      {
        error:
          'Another resurrection is currently in progress. Only one request at a time server-wide.',
      },
      { status: 429 }
    );
  }

  isProcessingServerWide = true;

  // 12s total timeout limit
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 12_000);

  try {
    const site = await resurrectUrl({
      url: rawUrl,
      signal: controller.signal,
    });

    // Store in memory cache only (NOT persisted to disk)
    urlCache.set(normalizedKey, site);

    return NextResponse.json({ site, cached: false });
  } catch (err) {
    if (controller.signal.aborted) {
      return NextResponse.json(
        { error: 'Resurrection timed out (12s total limit exceeded)' },
        { status: 504 }
      );
    }

    const message =
      err instanceof Error ? err.message : 'Unknown resurrection error';

    // Map honest reasons to appropriate HTTP status codes
    let status = 500;
    if (message.includes('no 200 capture found')) {
      status = 404;
    } else if (
      message.includes('rate limited') ||
      message.includes('429') ||
      message.includes('503')
    ) {
      status = 429;
    } else if (message.includes('timed out')) {
      status = 504;
    } else if (message.includes('insufficient body text')) {
      status = 422;
    }

    return NextResponse.json({ error: message }, { status });
  } finally {
    clearTimeout(timeoutId);
    isProcessingServerWide = false;
  }
}
