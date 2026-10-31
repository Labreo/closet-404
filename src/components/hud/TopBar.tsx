'use client';

import React from 'react';
import Link from 'next/link';

interface TopBarProps {
  count: number;
  muted: boolean;
  onToggleMute: () => void;
  onResurrect: () => void;
}

export function TopBar({ count, muted, onToggleMute, onResurrect }: TopBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-5 pb-10 bg-gradient-to-b from-[#0c0b0e]/85 via-[#0c0b0e]/40 to-transparent">
      <div className="pointer-events-auto pill rounded-2xl! px-4 py-2.5">
        <Link href="/" className="font-display text-[30px] leading-none text-ink">
          Closet <span className="italic text-marigold">404</span>
        </Link>
        <p className="mt-1 hidden sm:block font-mono text-[10px] tracking-[0.2em] text-muted">
          AN OFRENDA FOR THE DEAD WEB · {count} SHELVED
        </p>
      </div>
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        <div className="pill flex p-0.5 font-label text-[12px]">
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-ink">Closet</span>
          <Link href="/archive" className="px-3 py-1.5 rounded-full text-muted hover:text-ink">
            Index
          </Link>
        </div>
        <button
          type="button"
          onClick={onResurrect}
          className="pill px-3.5 py-1.5 font-label text-[12px] text-ink border-marigold/60 hover:border-marigold flex items-center gap-2"
        >
          <span className="text-marigold">✿</span> Resurrect a URL <span className="kbd">U</span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="pill px-3 py-1.5 font-mono text-[11px] text-muted hover:text-ink"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? 'sound off' : 'sound on'} <span className="kbd ml-1">M</span>
        </button>
      </div>
    </div>
  );
}
