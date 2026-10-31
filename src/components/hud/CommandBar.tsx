'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Site } from '@/types/archive';
import { closetStore, useClosetStore } from '@/components/closet/useClosetStore';
import { sound } from '@/lib/sound';

interface SearchHit {
  id: string;
  title: string;
  score: number;
}

const EXAMPLES = ['UFO', 'free music', 'dating', 'search engine', 'delivery'];

interface CommandBarProps {
  sites: Site[];
  hidden: boolean;
}

export function CommandBar({ sites, hidden }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const glowCount = useClosetStore((s) => s.searchGlowIds.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function search(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setBusy(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const all = res.ok ? ((await res.json()) as SearchHit[]) : [];
      const best = all[0]?.score ?? 0;
      const top = all.filter((h) => h.score >= best * 0.3).slice(0, 8);
      setHits(top);
      closetStore.setSearchGlowIds(top.map((h) => h.id));
      if (top.length > 0) sound.chime();
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setHits(null);
    setQuery('');
    closetStore.setSearchGlowIds([]);
  }

  if (hidden) {
    return (
      <div className="pointer-events-none absolute bottom-5 left-5 z-20 font-mono text-[11px] text-muted flex gap-3">
        <span>
          <span className="kbd">drag</span> spin the case
        </span>
        <span>
          <span className="kbd">Esc</span> put it back
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 pb-4 sm:pb-5 pointer-events-none">
      {hits && (
        <div className="pointer-events-auto pill px-2 py-1.5 flex flex-wrap items-center justify-center gap-1 max-w-[760px] fade-up">
          {hits.length === 0 ? (
            <span className="px-2 font-mono text-[11px] text-muted">No spine answers to “{query}”.</span>
          ) : (
            <>
              <span className="px-2 font-mono text-[11px] text-marigold">{glowCount} glowing</span>
              {hits.map((h) => {
                const site = sites.find((s) => s.id === h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => site && closetStore.selectSite(site)}
                    className="px-2.5 py-1 rounded-full text-[12px] text-ink hover:bg-white/10"
                  >
                    {h.title}
                  </button>
                );
              })}
            </>
          )}
          <button type="button" onClick={clear} className="px-2 font-mono text-[11px] text-muted hover:text-ink">
            clear ×
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="pointer-events-auto pill w-full max-w-[640px] flex items-center gap-2 pl-4 pr-1.5 py-1.5"
      >
        <span className="text-marigold text-[15px]">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              clear();
              inputRef.current?.blur();
            }
          }}
          placeholder="Shine the flashlight: search the dead by memory…"
          className="flex-1 min-w-0 bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none"
        />
        <span className="kbd hidden sm:inline">/</span>
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="px-4 py-1.5 rounded-full bg-marigold text-[#0c0b0e] font-label font-semibold text-[13px] disabled:opacity-40"
        >
          {busy ? '…' : 'Search'}
        </button>
      </form>

      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted">
        <span className="hidden md:inline">
          try{' '}
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => void search(ex)} className="mx-1 text-ink/70 hover:text-marigold">
              {ex}
            </button>
          ))}
        </span>
        <span>
          <span className="kbd">drag</span> look
        </span>
        <span className="hidden sm:inline">
          <span className="kbd">scroll</span> lean in
        </span>
        <span className="hidden sm:inline">
          <span className="kbd">R</span> random pull
        </span>
      </div>
    </div>
  );
}
