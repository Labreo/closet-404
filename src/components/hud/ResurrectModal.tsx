'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Site } from '@/types/archive';
import { closetStore } from '@/components/closet/useClosetStore';

interface ResurrectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResurrected?: (site: Site) => void;
}

export function ResurrectModal({
  isOpen,
  onClose,
  onResurrected,
}: ResurrectModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resurrectedSite, setResurrectedSite] = useState<Site | null>(null);
  const [wasCached, setWasCached] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResurrectedSite(null);
    setWasCached(false);

    try {
      const res = await fetch('/api/resurrect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = (await res.json()) as {
        site?: Site;
        error?: string;
        cached?: boolean;
      };

      if (!res.ok || !data.site) {
        setError(data.error || `HTTP ${res.status}: Failed to resurrect URL`);
        return;
      }

      setResurrectedSite(data.site);
      setWasCached(Boolean(data.cached));
      if (onResurrected) {
        onResurrected(data.site);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network failure during resurrection'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInCloset = () => {
    if (resurrectedSite) {
      closetStore.selectSite(resurrectedSite);
      handleClose();
    }
  };

  const handleQuickPick = (sampleUrl: string) => {
    setUrlInput(sampleUrl);
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resurrect-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col rounded-2xl border border-white/12 p-6 text-[#e9e4d8] shadow-2xl transition-all"
        style={{
          background: 'rgba(18, 17, 20, 0.92)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff9e00] animate-pulse" />
              <h2
                id="resurrect-title"
                className="font-serif text-2xl tracking-wide text-[#e9e4d8]"
              >
                Resurrect a URL
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs text-[#8a8578]">
              Live archaeology · Wayback CDX + Gemma 4 · kept for this visit only
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="px-2.5 py-1 font-mono text-xs text-[#8a8578] hover:text-[#e9e4d8] rounded border border-white/10 hover:border-white/20 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label
              htmlFor="url-input"
              className="block font-sans text-xs uppercase tracking-wider text-[#8a8578] mb-1.5"
            >
              Target Website URL
            </label>
            <div className="flex items-center gap-2">
              <input
                id="url-input"
                ref={inputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="e.g. sgi.com, netscape.com, heaven.com"
                disabled={loading}
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#0c0b0e] border border-white/15 font-mono text-sm text-[#e9e4d8] placeholder-[#8a8578]/60 focus:outline-none focus:border-[#ff9e00] transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="px-4 py-2.5 rounded-lg font-sans text-xs uppercase font-medium tracking-wider bg-[#ff9e00] text-[#0c0b0e] hover:bg-[#ffb020] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#0c0b0e] border-t-transparent rounded-full animate-spin" />
                    <span>Summoning...</span>
                  </>
                ) : (
                  <span>Resurrect</span>
                )}
              </button>
            </div>
          </div>

          {/* Quick suggestions */}
          {!loading && !resurrectedSite && (
            <div className="flex items-center gap-2 pt-1">
              <span className="font-mono text-[10px] text-[#8a8578]">Try:</span>
              {['sgi.com', 'netscape.com', 'cern.ch'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleQuickPick(s)}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#e9e4d8]/80 hover:text-[#ff9e00] hover:border-[#ff9e00]/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Loading state indicator */}
        {loading && (
          <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center gap-3.5">
            <div className="w-5 h-5 border-2 border-[#ff9e00] border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="space-y-0.5">
              <p className="font-sans text-xs text-[#e9e4d8]">
                Reaching into the Wayback Machine archives...
              </p>
              <p className="font-mono text-[11px] text-[#8a8578]">
                CDX query → id_ raw HTML → cheerio forensics → Gemma eulogy. Gemma
                thinks first, so this can take up to a minute.
              </p>
            </div>
          </div>
        )}

        {/* Honest failure reason */}
        {error && (
          <div className="mt-5 p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-200 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-bold font-mono text-xs">
                RESURRECTION FAILED:
              </span>
            </div>
            <p className="font-mono text-xs text-red-300 break-words">{error}</p>
            <p className="font-sans text-[11px] text-[#8a8578] pt-1">
              Honest telemetry: no fabricated fallbacks or mock data.
            </p>
          </div>
        )}

        {/* Resurrected Site Result */}
        {resurrectedSite && (
          <div className="mt-5 space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif text-xl text-[#e9e4d8]">
                    {resurrectedSite.title}
                  </h3>
                  <span
                    className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full border border-white/15"
                    style={{
                      color: resurrectedSite.accentColor || '#ff9e00',
                      borderColor: `${resurrectedSite.accentColor || '#ff9e00'}40`,
                    }}
                  >
                    {resurrectedSite.category}
                  </span>
                  {wasCached && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#8a8578]">
                      Memory Cached
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-[#8a8578] mt-0.5">
                  {resurrectedSite.url} • Captured{' '}
                  {resurrectedSite.firstCaptured} – {resurrectedSite.lastCaptured}
                </p>
              </div>
            </div>

            {/* Eulogy */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[10px] uppercase tracking-wider text-[#ff9e00]">
                  Eulogy
                </span>
                <span className="font-mono text-[10px] text-[#8a8578]">
                  AI-generated by {resurrectedSite.generatedBy}
                </span>
              </div>
              <p className="font-serif text-sm leading-relaxed text-[#e9e4d8]/90 italic">
                &ldquo;{resurrectedSite.eulogy}&rdquo;
              </p>
            </div>

            {/* Forensics Preview */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-[#0c0b0e] space-y-2">
              <span className="font-mono text-[10px] uppercase text-[#8a8578] tracking-wider block">
                Extracted Forensics (Cheerio)
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs text-[#e9e4d8]/80">
                <div>
                  <span className="text-[#8a8578]">Generator: </span>
                  {resurrectedSite.forensics.generator || 'none recorded'}
                </div>
                <div>
                  <span className="text-[#8a8578]">Today: </span>
                  <span
                    className={
                      resurrectedSite.liveStatus.status === 200
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {resurrectedSite.liveStatus.note}
                  </span>
                </div>
                <div>
                  <span className="text-[#8a8578]">Comments: </span>
                  {resurrectedSite.forensics.comments.length} preserved
                </div>
                <div>
                  <span className="text-[#8a8578]">Images: </span>
                  {resurrectedSite.forensics.images.length} preserved
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <a
                href={resurrectedSite.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-[#8a8578] hover:text-[#e9e4d8] underline underline-offset-4"
              >
                Open on Wayback ↗
              </a>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResurrectedSite(null);
                    setUrlInput('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/15 font-sans text-xs text-[#e9e4d8] hover:bg-white/5 transition-colors"
                >
                  Resurrect Another
                </button>
                <button
                  type="button"
                  onClick={handleSelectInCloset}
                  className="px-3.5 py-1.5 rounded-lg bg-[#ff9e00] text-[#0c0b0e] font-sans text-xs font-medium tracking-wide hover:bg-[#ffb020] transition-colors"
                >
                  Inspect in 3D Closet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
