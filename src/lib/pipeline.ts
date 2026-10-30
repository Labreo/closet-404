import * as cheerio from 'cheerio';
import { z } from 'zod';
import { chat } from './llm';
import type {
  Site,
  SiteCategory,
  LiveStatus,
  SiteForensics,
  SiteImage,
} from '../types/archive';

export const siteLlmOutputSchema = z.object({
  title: z.string().min(1),
  category: z.enum([
    'geocities',
    'dotcom',
    'oss',
    'webring',
    'blog',
    'netart',
    'other',
  ]),
  eulogy: z.string().min(10),
  ghostPersona: z.string().min(10),
  vibeTags: z.array(z.string()).min(4),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type SiteLlmOutput = z.infer<typeof siteLlmOutputSchema>;

export interface ResurrectOptions {
  url: string;
  signal?: AbortSignal;
}

export function slugifyUrl(u: string): string {
  return u
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function decodeHtml(
  buffer: Buffer,
  contentTypeHeader: string | null
): string {
  let charset = 'utf-8';
  if (contentTypeHeader) {
    const match = contentTypeHeader.match(/charset=([a-zA-Z0-9_-]+)/i);
    if (match) {
      charset = match[1].toLowerCase();
    }
  }

  // Check <meta> tags in the first 4KB
  const preview = buffer.subarray(0, 4096).toString('binary');
  const metaMatch =
    preview.match(/<meta\s+[^>]*charset=["']?([a-zA-Z0-9_-]+)/i) ||
    preview.match(/<meta\s+[^>]*content=["'][^"']*charset=([a-zA-Z0-9_-]+)/i);
  if (metaMatch) {
    charset = metaMatch[1].toLowerCase();
  }

  if (
    charset === 'iso-8859-1' ||
    charset === 'latin1' ||
    charset === 'windows-1252' ||
    charset === 'cp1252'
  ) {
    charset = 'windows-1252';
  }

  try {
    const decoder = new TextDecoder(charset);
    return decoder.decode(buffer);
  } catch {
    try {
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }
}

interface DomNode {
  type?: string;
  data?: string;
  children?: DomNode[];
}

export function extractForensics(html: string): {
  forensics: SiteForensics;
  isValidBody: boolean;
} {
  const $ = cheerio.load(html);

  const title =
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    '';

  const metaDescription =
    $('meta[name="description" i]')
      .attr('content')
      ?.replace(/\s+/g, ' ')
      .trim() ||
    $('meta[property="og:description" i]')
      .attr('content')
      ?.replace(/\s+/g, ' ')
      .trim() ||
    '';

  const generator =
    $('meta[name="generator" i]')
      .attr('content')
      ?.replace(/\s+/g, ' ')
      .trim() || '';

  // Comments (up to 8 real HTML comments, skip empty and boilerplate)
  const comments: string[] = [];
  function extractComments(nodes: DomNode[]) {
    for (const node of nodes) {
      if (node.type === 'comment') {
        const text = node.data?.trim();
        if (text) {
          const isBoilerplate =
            text.startsWith('[if ') ||
            text.startsWith('<![endif') ||
            text.startsWith('#echo') ||
            text.toLowerCase().includes('archive.org') ||
            text.toLowerCase().includes('wayback') ||
            text.toLowerCase().includes('file archived on') ||
            text === '//' ||
            text === '-->' ||
            text === '<!--';
          if (!isBoilerplate && !comments.includes(text)) {
            comments.push(text);
            if (comments.length >= 8) return;
          }
        }
      }
      if (node.children && Array.isArray(node.children)) {
        extractComments(node.children);
        if (comments.length >= 8) return;
      }
    }
  }
  extractComments($._root.children as DomNode[]);

  // Images (up to 8 img {src, alt})
  const images: SiteImage[] = [];
  $('img').each((_, el) => {
    if (images.length >= 8) return;
    const src = $(el).attr('src')?.trim();
    if (src) {
      const alt = $(el).attr('alt')?.replace(/\s+/g, ' ').trim() || '';
      if (!images.some((img) => img.src === src)) {
        images.push({ src, alt });
      }
    }
  });

  // Outbound Links (up to 8 outbound hrefs)
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    if (links.length >= 8) return;
    const href = $(el).attr('href')?.trim();
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      if (!href.includes('web.archive.org') && !links.includes(href)) {
        links.push(href);
      }
    }
  });

  // Visible body text (strip script/style/noscript, collapse whitespace, max 2500 chars)
  $('script, style, noscript, svg, iframe').remove();
  const rawBodyText = $('body').text() || $('html').text();
  const bodyText = rawBodyText.replace(/\s+/g, ' ').trim().slice(0, 2500);

  const isValidBody = bodyText.length >= 200;

  return {
    forensics: {
      title,
      metaDescription,
      generator,
      comments,
      images,
      links,
      bodyText,
    },
    isValidBody,
  };
}

export async function checkLiveStatus(
  targetUrl: string,
  signal?: AbortSignal
): Promise<LiveStatus> {
  const normalized = targetUrl.startsWith('http')
    ? targetUrl
    : `https://${targetUrl}`;
  let targetHost = '';
  try {
    targetHost = new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    targetHost = targetUrl;
  }

  // Quick live check timeout (4s) so total pipeline easily fits in 12s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  const onParentAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  try {
    let res = await fetch(normalized, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Closet404/1.0 (hackathon)' },
    });

    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(normalized, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Closet404/1.0 (hackathon)' },
      });
    }

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onParentAbort);

    const finalHost = new URL(res.url).hostname.replace(/^www\./, '');
    const redirected = finalHost.toLowerCase() !== targetHost.toLowerCase();
    const note = redirected
      ? `Redirects to ${finalHost} (HTTP ${res.status})`
      : `HTTP ${res.status}`;
    return { status: res.status, note };
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onParentAbort);

    // Fallback to HTTP if HTTPS had connection error
    if (normalized.startsWith('https://')) {
      try {
        const httpUrl = normalized.replace('https://', 'http://');
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 3000);
        const res2 = await fetch(httpUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: c2.signal,
          headers: { 'User-Agent': 'Closet404/1.0 (hackathon)' },
        });
        clearTimeout(t2);
        const finalHost = new URL(res2.url).hostname.replace(/^www\./, '');
        const redirected = finalHost.toLowerCase() !== targetHost.toLowerCase();
        return {
          status: res2.status,
          note: redirected
            ? `Redirects to ${finalHost} (HTTP ${res2.status})`
            : `HTTP ${res2.status}`,
        };
      } catch {
        // Fall through to error
      }
    }

    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('abort'));
    const note = isTimeout
      ? 'Connection timed out (4s)'
      : 'Host unreachable / DNS failure';
    return { status: null, note };
  }
}

export async function callLlmForSite(
  u: string,
  forensics: SiteForensics,
  firstCaptured: number,
  lastCaptured: number
): Promise<SiteLlmOutput> {
  const prompt = `SOURCE:
URL: ${u}
First Captured Year: ${firstCaptured}
Last Captured Year: ${lastCaptured}
Title: ${forensics.title || 'unknown'}
Meta Description: ${forensics.metaDescription || 'unknown'}
Generator: ${forensics.generator || 'unknown'}
HTML Comments:
${forensics.comments.length > 0 ? forensics.comments.map((c) => `- ${c}`).join('\n') : 'none'}
Images:
${forensics.images.length > 0 ? forensics.images.map((img) => `- src: "${img.src}", alt: "${img.alt}"`).join('\n') : 'none'}
Links:
${forensics.links.length > 0 ? forensics.links.map((l) => `- ${l}`).join('\n') : 'none'}
Body Text Sample:
${forensics.bodyText}

Analyze this website from the SOURCE provided. Return a JSON object with:
- "title": Clean concise name or title for this archive entry (string)
- "category": One of 'geocities', 'dotcom', 'oss', 'webring', 'blog', 'netart', 'other'
- "eulogy": 2 to 3 sentences, atmospheric but strictly factual based on SOURCE
- "ghostPersona": First-person voice instructions describing how this website speaks and remembers its era
- "vibeTags": Exactly 8 lowercase descriptive keywords capturing its visual, era, and cultural vibe (array of 8 strings)
- "accentColor": Hex color "#RRGGBB" that visually fits the site's era or palette
`;

  // Try LLM call, retry once if parse/validation fails
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await chat({
        messages: [
          {
            role: 'system',
            content:
              "Use only the SOURCE provided. If something is not in SOURCE, write 'unknown'. Do not invent names, dates, or events.",
          },
          { role: 'user', content: prompt },
        ],
        json: true,
        temperature: 0.4,
        maxTokens: 600,
      });

      const parsedJson = JSON.parse(reply);
      const validated = siteLlmOutputSchema.parse(parsedJson);

      // Ensure vibeTags has exactly 8 items
      let vibeTags = validated.vibeTags
        .map((t) => t.toLowerCase().trim().replace(/[^a-z0-9_-]/g, ''))
        .filter(Boolean);
      if (vibeTags.length > 8) vibeTags = vibeTags.slice(0, 8);
      while (vibeTags.length < 8) vibeTags.push('retro');

      return {
        ...validated,
        vibeTags,
      };
    } catch (err) {
      if (attempt === 0) {
        process.env.LLM_MODEL = 'gemini-3.5-flash-lite';
        continue;
      }
      throw err;
    }
  }

  throw new Error('LLM call failed after retry');
}

/**
 * Resurrects a URL via the archive pipeline without writing to disk.
 * Respects abort signals and returns honest failure reasons.
 */
export async function resurrectUrl({
  url: rawUrl,
  signal,
}: ResurrectOptions): Promise<Site> {
  const u = rawUrl.trim();
  if (!u) {
    throw new Error('No URL provided');
  }

  const id = slugifyUrl(u);

  // Step 1: CDX query with 4s timeout
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(
    u
  )}&output=json&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:6&limit=200`;

  let cdxRes: Response;
  try {
    cdxRes = await fetch(cdxUrl, {
      headers: {
        'User-Agent': 'Closet404/1.0 (hackathon)',
        Accept: 'application/json',
      },
      signal,
    });
  } catch (err) {
    if (signal?.aborted) {
      throw new Error('archive.org request timed out');
    }
    throw err;
  }

  if (cdxRes.status === 429 || cdxRes.status === 503) {
    throw new Error('archive.org rate limited, try again in a minute');
  }

  if (!cdxRes.ok) {
    throw new Error(`archive.org CDX returned HTTP ${cdxRes.status}`);
  }

  let cdxData: string[][];
  try {
    cdxData = (await cdxRes.json()) as string[][];
  } catch {
    throw new Error('Failed to parse archive.org CDX response');
  }

  if (!Array.isArray(cdxData) || cdxData.length <= 1) {
    throw new Error('no 200 capture found');
  }

  const rows = cdxData.slice(1);
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  const firstCaptured = parseInt(firstRow[1].slice(0, 4), 10);
  const lastCaptured = parseInt(lastRow[1].slice(0, 4), 10);

  // Choose snapshot: earliest capture in first third of range whose HTML > 2KB; try up to 3 candidates
  const firstThirdCount = Math.max(1, Math.ceil(rows.length / 3));
  const candidateRows = [...rows.slice(0, firstThirdCount)];
  if (candidateRows.length < 3) {
    candidateRows.push(...rows.slice(firstThirdCount));
  }

  let selectedSnapshot: {
    timestamp: string;
    originalUrl: string;
    html: string;
    forensics: SiteForensics;
  } | null = null;

  let candidatesTried = 0;

  for (const row of candidateRows) {
    if (candidatesTried >= 3) break;
    if (signal?.aborted) {
      throw new Error('archive.org request timed out');
    }

    const [, ts, origUrl] = row;
    const snapshotUrl = `https://web.archive.org/web/${ts}id_/${origUrl}`;

    try {
      const snapRes = await fetch(snapshotUrl, {
        headers: {
          'User-Agent': 'Closet404/1.0 (hackathon)',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
        signal,
      });

      if (snapRes.status === 429 || snapRes.status === 503) {
        throw new Error('archive.org rate limited, try again in a minute');
      }

      if (!snapRes.ok) {
        continue;
      }

      const rawBuffer = Buffer.from(await snapRes.arrayBuffer());
      if (rawBuffer.byteLength <= 2048) {
        continue;
      }

      candidatesTried++;
      const contentType = snapRes.headers.get('content-type');
      const decodedHtml = decodeHtml(rawBuffer, contentType);

      const { forensics, isValidBody } = extractForensics(decodedHtml);
      if (!isValidBody) {
        continue;
      }

      selectedSnapshot = {
        timestamp: ts,
        originalUrl: origUrl,
        html: decodedHtml,
        forensics,
      };
      break;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('rate limited')
      ) {
        throw err;
      }
      // Continue to next candidate
    }
  }

  if (!selectedSnapshot) {
    throw new Error('insufficient body text (<200 chars) or HTML <= 2KB');
  }

  // Live status check (concurrent or fast sequential)
  const liveStatus = await checkLiveStatus(u, signal);

  // LLM call
  const llmOutput = await callLlmForSite(
    u,
    selectedSnapshot.forensics,
    firstCaptured,
    lastCaptured
  );

  const siteCategory: SiteCategory = u.includes('geocities.com')
    ? 'geocities'
    : llmOutput.category;

  const site: Site = {
    id,
    spine: 0,
    url: u,
    title: llmOutput.title || selectedSnapshot.forensics.title || u,
    category: siteCategory,
    firstCaptured,
    lastCaptured,
    snapshotTimestamp: selectedSnapshot.timestamp,
    rawUrl: `https://web.archive.org/web/${selectedSnapshot.timestamp}id_/${selectedSnapshot.originalUrl}`,
    viewUrl: `https://web.archive.org/web/${selectedSnapshot.timestamp}/${selectedSnapshot.originalUrl}`,
    liveStatus,
    forensics: selectedSnapshot.forensics,
    eulogy: llmOutput.eulogy,
    ghostPersona: llmOutput.ghostPersona,
    vibeTags: llmOutput.vibeTags,
    accentColor: llmOutput.accentColor,
    generatedBy: process.env.LLM_MODEL ?? 'gemini-3.5-flash-lite',
  };

  return site;
}
