import { z } from 'zod';
import { chat, LLMError } from '@/lib/llm';
import { getCoronerReport, getSite, siteSchema } from '@/lib/data';
import { buildSeancePrompt } from '@/lib/seance';
import { allowRequest, clientIp, RATE_LIMIT_MESSAGE } from '@/lib/ratelimit';

/** Sent once per hidden reasoning chunk; the client strips it and shows a trance meter. */
const THINKING_MARKER = '\u0001';

const bodySchema = z.object({
  siteId: z.string().min(1).max(200),
  mode: z.enum(['chat', 'reconstruct']).default('chat'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
  /** Only used for live resurrections that are not on the shelf. */
  site: siteSchema.optional(),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response('Invalid séance request.', { status: 400 });
  }

  const { siteId, mode, messages } = parsed.data;
  const site = getSite(siteId) ?? (parsed.data.site?.id === siteId ? parsed.data.site : undefined);
  if (!site) {
    return new Response('No such spine in the closet.', { status: 404 });
  }

  if (!allowRequest('seance', clientIp(request.headers), 20, 400)) {
    return new Response(RATE_LIMIT_MESSAGE, { status: 429 });
  }

  const trimmed = messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.role === 'user' ? m.content.slice(0, 500) : m.content,
  }));

  try {
    const stream = await chat({
      messages: [
        { role: 'system', content: buildSeancePrompt(site, mode, getCoronerReport(siteId)) },
        ...trimmed,
      ],
      stream: true,
      maxTokens: 400,
      temperature: 0.7,
      timeoutMs: 150_000,
      thinkingMarker: THINKING_MARKER,
    });

    return new Response(stream.pipeThrough(new TextEncoderStream()), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Ghost-Model': process.env.LLM_MODEL ?? 'unknown',
      },
    });
  } catch (err) {
    const status = err instanceof LLMError && err.status === 429 ? 429 : 502;
    const message =
      status === 429
        ? RATE_LIMIT_MESSAGE
        : `The medium lost the connection (${err instanceof Error ? err.message.slice(0, 160) : 'unknown error'}).`;
    return new Response(message, { status });
  }
}
