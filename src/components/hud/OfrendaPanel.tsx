'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import type { Site } from '@/types/archive';

interface Note {
  name: string;
  message: string;
  at: string;
}

const KEY = (id: string) => `closet404:ofrenda:${id}`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readRaw(id: string): string {
  try {
    return window.localStorage.getItem(KEY(id)) ?? '[]';
  } catch {
    return '[]';
  }
}

function parse(raw: string): Note[] {
  try {
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

/** A personal remembrance wall. Notes stay in this browser only (localStorage). */
export function OfrendaPanel({ site }: { site: Site }) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(site.id), () => '[]');
  const notes = useMemo(() => parse(raw), [raw]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  function leave(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const next = [{ name: name.trim() || 'a visitor', message: message.trim(), at: new Date().toISOString() }, ...notes];
    setMessage('');
    try {
      window.localStorage.setItem(KEY(site.id), JSON.stringify(next.slice(0, 50)));
    } catch {
      // storage unavailable in this browser
    }
    listeners.forEach((l) => l());
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink/80 leading-relaxed">
        On Día de los Muertos the dead come home to the things they loved. Leave a marigold for {site.title}: a memory,
        a thank-you, the first thing you did there.
      </p>
      <form onSubmit={leave} className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Your name (optional)"
          className="w-full bg-black/40 border border-hairline rounded-lg px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-marigold"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder={`I remember ${site.title} because…`}
          className="w-full bg-black/40 border border-hairline rounded-lg px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-marigold resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted">Saved only in your browser.</span>
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-1.5 rounded-full bg-marigold text-[#0c0b0e] font-mono text-[12px] font-bold disabled:opacity-40"
          >
            ✿ Leave a marigold
          </button>
        </div>
      </form>
      <ul className="space-y-3">
        {notes.map((n, i) => (
          <li key={`${n.at}-${i}`} className="border-l-2 border-marigold/70 pl-3">
            <p className="font-display text-[18px] leading-snug text-ink">{n.message}</p>
            <p className="font-mono text-[10px] text-muted mt-1">
              — {n.name}, {new Date(n.at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
