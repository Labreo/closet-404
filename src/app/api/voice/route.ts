import { z } from 'zod';
import { allowRequest, clientIp } from '@/lib/ratelimit';

const bodySchema = z.object({ text: z.string().min(1).max(1200) });

/**
 * Text-to-speech for the ghost via ElevenLabs. Returns 501 when no key is
 * configured so the browser falls back to its own speech synthesis.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return new Response('Voice not configured', { status: 501 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response('Invalid voice request', { status: 400 });
  }

  if (!allowRequest('voice', clientIp(request.headers), 15, 200)) {
    return new Response('Too many voice requests', { status: 429 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || 'JBFqnCBsd6RMkjVDRZzb';
  const model = process.env.ELEVENLABS_MODEL?.trim() || 'eleven_multilingual_v2';

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: parsed.data.text,
      model_id: model,
      voice_settings: { stability: 0.35, similarity_boost: 0.7, style: 0.45 },
    }),
  });

  if (!res.ok || !res.body) {
    return new Response(`Voice service error ${res.status}`, { status: 502 });
  }

  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
