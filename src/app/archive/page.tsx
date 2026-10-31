import type { Metadata } from 'next';
import Link from 'next/link';
import { getCoronerReports, getSites } from '@/lib/data';
import { spineNumber } from '@/components/closet/TextureFactory';

export const metadata: Metadata = {
  title: 'The index — Closet 404',
  description: 'Every website shelved in Closet 404, with its Wayback Machine capture years and its status today.',
};

export default function ArchiveIndex() {
  const sites = getSites();
  const coroner = getCoronerReports();
  const earliest = Math.min(...sites.map((s) => s.firstCaptured));
  const comments = sites.reduce((n, s) => n + s.forensics.comments.length, 0);
  const images = sites.reduce((n, s) => n + s.forensics.images.length, 0);

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-8 py-10 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-8">
          <div>
            <Link href="/" className="font-mono text-[11px] tracking-[0.2em] text-muted hover:text-marigold">
              ← BACK INTO THE CLOSET
            </Link>
            <h1 className="font-display text-[clamp(52px,8vw,96px)] leading-[0.9] mt-4">
              The <span className="italic text-marigold">index</span>
            </h1>
            <p className="mt-4 max-w-[560px] text-[15px] text-ink/75 leading-relaxed">
              Every case on the shelves. Capture years come from the Wayback Machine&apos;s CDX index; &ldquo;today&rdquo;
              is what the address returned when we knocked. Titles and eulogies were written by an open-weight Gemma
              model from each snapshot.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 font-mono">
            {[
              [sites.length, 'sites shelved'],
              [comments, 'HTML comments recovered'],
              [images, 'image references'],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <dt className="text-[10px] tracking-[0.14em] text-muted uppercase">{label}</dt>
                <dd className="text-[28px] text-ink mt-1">{n}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
                <th className="py-4 pr-4 font-normal">No.</th>
                <th className="py-4 pr-4 font-normal">Site</th>
                <th className="py-4 pr-4 font-normal">Captured</th>
                <th className="py-4 pr-4 font-normal">Kind</th>
                <th className="py-4 pr-4 font-normal">Coroner</th>
                <th className="py-4 font-normal">The address today</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className="border-t border-hairline group">
                  <td className="py-4 pr-4 font-mono text-[12px] text-marigold align-top">{spineNumber(s.spine)}</td>
                  <td className="py-4 pr-4 align-top">
                    <Link href={`/site/${s.id}`} className="font-display text-[24px] leading-tight group-hover:text-marigold">
                      {s.title}
                    </Link>
                    <p className="font-mono text-[11px] text-muted mt-0.5">{s.url}</p>
                  </td>
                  <td className="py-4 pr-4 font-mono text-[12px] align-top whitespace-nowrap">
                    {s.firstCaptured}–{s.lastCaptured}
                  </td>
                  <td className="py-4 pr-4 font-mono text-[11px] text-muted uppercase align-top">{s.category}</td>
                  <td className="py-4 pr-4 font-mono text-[11px] align-top">
                    {coroner[s.id] ? (
                      <span className="text-ink">{coroner[s.id].sources.length} sources</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-4 font-mono text-[11px] text-muted align-top max-w-[260px]">{s.liveStatus.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="mt-12 border-t border-hairline pt-6 font-mono text-[11px] text-muted leading-relaxed">
          Earliest capture on the shelf: {earliest}. Snapshots fetched with the Wayback Machine&apos;s <code>id_</code>{' '}
          replay so the original HTML arrives without the archive toolbar.
        </footer>
      </div>
    </main>
  );
}
