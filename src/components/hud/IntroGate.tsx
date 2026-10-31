'use client';

import React from 'react';
import Link from 'next/link';
import { closetStore, useClosetStore } from '@/components/closet/useClosetStore';
import { sound } from '@/lib/sound';

export function IntroGate({ count }: { count: number }) {
  const entered = useClosetStore((s) => s.entered);
  if (entered) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(12,11,14,0.55)_0%,rgba(12,11,14,0.94)_70%)] backdrop-blur-[3px] px-6">
      <div className="max-w-[620px] text-center fade-up">
        <p className="font-mono text-[11px] tracking-[0.28em] text-marigold">AN OFRENDA FOR THE DEAD WEB</p>
        <h1 className="font-display text-[clamp(64px,12vw,128px)] leading-[0.9] mt-4 text-ink">
          Closet <span className="italic text-marigold">404</span>
        </h1>
        <p className="mt-6 text-[16px] leading-relaxed text-ink/80">
          {count} websites that went dark, pulled back out of the Wayback Machine and shelved by candlelight. Take one
          down and hold a séance: an open-weight Gemma model speaks as the site, remembering only what survived in its
          HTML.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            autoFocus
            onClick={() => {
              sound.start();
              closetStore.enter();
            }}
            className="px-7 py-3 rounded-full bg-marigold text-[#0c0b0e] font-label font-semibold text-[15px] hover:brightness-110 shadow-[0_0_40px_rgba(255,158,0,0.35)]"
          >
            Enter the closet
          </button>
          <Link href="/archive" className="font-mono text-[12px] text-muted hover:text-ink">
            or read the index →
          </Link>
        </div>
        <p className="mt-10 font-mono text-[10.5px] text-muted leading-relaxed">
          Scraped text always links to its archive.org source. Anything a model wrote is labeled AI-generated.
          <br />
          Sound on. Drag to look around. Scroll to lean in.
        </p>
      </div>
    </div>
  );
}
