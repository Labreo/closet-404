import React from 'react';
import type { Site } from '@/types/archive';

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-marigold">
        {title}
        {count !== undefined && <span className="text-muted"> · {count}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Everything here is scraped verbatim from the Wayback Machine snapshot. */
export function ForensicsPanel({ site }: { site: Site }) {
  const f = site.forensics;
  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] text-muted leading-relaxed">
        Scraped verbatim from{' '}
        <a href={site.rawUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-hairline hover:text-marigold break-all">
          {site.rawUrl}
        </a>
        . Nothing on this tab is written by a model.
      </p>

      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 font-mono text-[11.5px]">
        <dt className="text-muted">page title</dt>
        <dd className="text-ink">{f.title || '—'}</dd>
        <dt className="text-muted">built with</dt>
        <dd className="text-ink">{f.generator || 'not declared'}</dd>
        <dt className="text-muted">first captured</dt>
        <dd className="text-ink">{site.firstCaptured}</dd>
        <dt className="text-muted">last captured</dt>
        <dd className="text-ink">{site.lastCaptured}</dd>
        <dt className="text-muted">the URL today</dt>
        <dd className="text-ink">{site.liveStatus.note}</dd>
      </dl>

      <Section title="HTML COMMENTS" count={f.comments.length}>
        {f.comments.length === 0 ? (
          <p className="font-mono text-[11px] text-muted">The builder left no comments.</p>
        ) : (
          <ul className="crt rounded-lg border border-hairline p-3 space-y-1.5">
            {f.comments.map((c, i) => (
              <li key={i} className="font-mono text-[11.5px] text-[#9fd49a] break-words">
                &lt;!-- {c} --&gt;
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="IMAGES (LOST OR ARCHIVED)" count={f.images.length}>
        {f.images.length === 0 ? (
          <p className="font-mono text-[11px] text-muted">No images in this snapshot.</p>
        ) : (
          <ul className="space-y-1">
            {f.images.map((img, i) => (
              <li key={i} className="font-mono text-[11px] text-ink break-all">
                {img.src}
                {img.alt && <span className="text-muted"> · alt &ldquo;{img.alt}&rdquo;</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {f.links.length > 0 && (
        <Section title="OUTBOUND LINKS" count={f.links.length}>
          <ul className="space-y-1">
            {f.links.map((l, i) => (
              <li key={i} className="font-mono text-[11px] text-muted break-all">
                {l}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="PAGE TEXT">
        <p className="font-[Times_New_Roman,serif] text-[14px] leading-relaxed text-ink/85 bg-white/[0.03] border border-hairline rounded-lg p-3">
          {f.bodyText}
        </p>
      </Section>
    </div>
  );
}
