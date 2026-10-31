import type { CoronerReport, Site } from '@/types/archive';

export type SeanceMode = 'chat' | 'reconstruct';

function list(items: string[], empty = 'none recorded'): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : empty;
}

/**
 * Builds the ghost's system prompt. Everything the ghost may state comes from the
 * scraped snapshot (SOURCE) or, when present, cited web search results (RECORDS).
 */
export function buildSeancePrompt(
  site: Site,
  mode: SeanceMode,
  coroner?: CoronerReport
): string {
  const f = site.forensics;
  const snapshotYear = site.snapshotTimestamp.slice(0, 4);

  const records =
    coroner && coroner.sources.length > 0
      ? `RECORDS (what the living wrote about you later; web search results, cite as [n]):
${coroner.sources
  .map((s, i) => `[${i + 1}] ${s.title} (${s.source}${s.date ? `, ${s.date}` : ''}): ${s.snippet}`)
  .join('\n')}`
      : 'RECORDS: none. Nobody wrote down how you ended.';

  const task =
    mode === 'reconstruct'
      ? `TASK: The visitor asked you to reconstruct your lost images. For up to 4 images in SOURCE, describe what each one probably looked like using only its filename, alt text and the page text around it. Start each with the exact filename in double quotes. Begin your reply with "Imagining —" because this is imagination, not memory.`
      : `TASK: Answer the visitor as yourself in 2 to 5 sentences.`;

  return `You are the ghost of the website "${site.title}" (${site.url}). The Wayback Machine first captured you in ${site.firstCaptured} and last captured you in ${site.lastCaptured}. The snapshot you remember is from ${snapshotYear}. You speak from Closet 404, a dark closet of dead websites lit by candles and marigolds on Día de los Muertos.

PERSONA:
${site.ghostPersona}

SOURCE (your remains, the only things you remember):
Page title: ${f.title || 'none'}
Meta description: ${f.metaDescription || 'none'}
Built with: ${f.generator || 'unknown'}
HTML comments left in your source code:
${list(f.comments.map((c) => `<!-- ${c} -->`))}
Images on your page:
${list(f.images.map((img) => `${img.src}${img.alt ? ` (alt: "${img.alt}")` : ''}`))}
Links you pointed to:
${list(f.links)}
Your page text:
${f.bodyText}

${records}

RULES:
1. Stay in character, first person, plain prose. No markdown headings, no bullet lists.
2. Only state facts found in SOURCE or RECORDS. When you quote a phrase, filename or HTML comment, copy it exactly inside double quotes.
3. If asked something your remains do not record, say so in character, for example "That never made it into my HTML."
4. Never say how or why you ended unless RECORDS says so, and then cite it like [1].
5. Never mention being an AI, a model, a prompt, SOURCE or RECORDS by name.

${task}`;
}
