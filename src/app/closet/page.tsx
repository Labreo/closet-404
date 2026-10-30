'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import archiveData from '../../../data/archive.json';
import type { Site } from '@/types/archive';
import { useClosetStore, closetStore } from '@/components/closet/useClosetStore';

const ClosetScene = dynamic(
  () => import('@/components/closet/ClosetScene'),
  { ssr: false }
);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ClosetPage() {
  const sites = archiveData as Site[];
  const selectedSite = useClosetStore((s) => s.selectedSite);

  // Drawer Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChipClick = (chipText: string) => {
    setInput(chipText);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !selectedSite || isLoading) return;

    const userText = input.trim();
    setInput('');

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userText },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/seance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSite.id,
          messages: newMessages.slice(-6),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `[Séance interrupted]: ${errorText || 'Failed to reach spectral relay.'}`,
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantReply += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: assistantReply,
            };
            return updated;
          });
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '[Séance Connection Note]: Digital static detected. (Tip: local inference is available with Ollama).',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0b0e] text-[#e9e4d8] font-sans">
      {/* 3D Scene */}
      <ClosetScene sites={sites} />

      {/* Floating HUD Instructions */}
      <div className="absolute top-4 left-6 pointer-events-none flex flex-col gap-1 z-10">
        <h1 className="text-xl font-serif text-[#e9e4d8] tracking-wide">
          CLOSET 404
        </h1>
        <p className="text-xs font-mono text-[#8a8578]">
          [Drag] look &bull; [Scroll] fov zoom &bull; [W/S/&uarr;/&darr;] height &bull; [Click] inspect &bull; [Esc] put back
        </p>
      </div>

      {/* Back to Index toggle */}
      <div className="absolute top-4 right-6 z-10">
        <Link
          href="/"
          className="px-4 py-1.5 text-xs font-mono text-[#e9e4d8] rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(18,17,20,0.78)] backdrop-blur-[16px] hover:border-[#ff9e00] transition-colors"
        >
          Index View &rarr;
        </Link>
      </div>

      {/* Slide-out Drawer on the Right for Selected Site */}
      {selectedSite && (
        <aside className="absolute top-0 right-0 h-full w-[440px] max-w-[90vw] z-30 flex flex-col bg-[rgba(18,17,20,0.88)] backdrop-blur-[16px] border-l border-[rgba(255,255,255,0.12)] shadow-2xl transition-all duration-300">
          {/* Drawer Header */}
          <div className="p-5 border-b border-[rgba(255,255,255,0.12)] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-[#ff9e00]">
                  #{selectedSite.spine.toString().padStart(3, '0')}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded border border-[rgba(255,255,255,0.1)] text-[#8a8578] uppercase">
                  {selectedSite.category}
                </span>
                <span className="font-mono text-xs text-[#8a8578]">
                  {selectedSite.firstCaptured} &mdash; {selectedSite.lastCaptured}
                </span>
              </div>
              <h2 className="text-xl font-serif font-medium text-[#e9e4d8] leading-tight">
                {selectedSite.title}
              </h2>
              <a
                href={`https://${selectedSite.url}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-[#8a8578] hover:text-[#ff9e00] transition-colors break-all"
              >
                {selectedSite.url}
              </a>
            </div>

            <button
              onClick={() => closetStore.deselectSite()}
              className="p-1 text-[#8a8578] hover:text-[#e9e4d8] transition-colors"
              title="Close [Esc]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Drawer Body - Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
            {/* Eulogy */}
            <div>
              <div className="text-xs font-mono text-[#8a8578] mb-1">
                Eulogy (AI-generated by {selectedSite.generatedBy})
              </div>
              <p className="text-sm text-[#e9e4d8] leading-relaxed italic">
                &ldquo;{selectedSite.eulogy}&rdquo;
              </p>
            </div>

            {/* Vibe Tags */}
            <div className="flex flex-wrap gap-1.5">
              {selectedSite.vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[#8a8578]"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Forensics Section */}
            <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 space-y-3">
              <h3 className="font-mono text-xs text-[#ff9e00] tracking-wider uppercase">
                Forensics
              </h3>

              {/* Generator & Live Status */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[#8a8578]">Generator:</span>{' '}
                  <span className="text-[#e9e4d8]">
                    {selectedSite.forensics.generator || 'unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-[#8a8578]">Today:</span>{' '}
                  <span className="text-[#e9e4d8]">
                    {selectedSite.liveStatus.note}
                  </span>
                </div>
              </div>

              {/* Real HTML Comments */}
              {selectedSite.forensics.comments.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-[#8a8578]">
                    HTML Comments ({selectedSite.forensics.comments.length}):
                  </span>
                  <div className="mt-1 space-y-1 max-h-32 overflow-y-auto bg-[rgba(0,0,0,0.3)] p-2 rounded border border-[rgba(255,255,255,0.06)]">
                    {selectedSite.forensics.comments.map((comment, i) => (
                      <div key={i} className="font-mono text-[11px] text-[#e9e4d8] break-all">
                        &lt;!-- {comment} --&gt;
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real Images */}
              {selectedSite.forensics.images.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-[#8a8578]">
                    Images ({selectedSite.forensics.images.length}):
                  </span>
                  <div className="mt-1 space-y-1 max-h-28 overflow-y-auto bg-[rgba(0,0,0,0.3)] p-2 rounded border border-[rgba(255,255,255,0.06)]">
                    {selectedSite.forensics.images.map((img, i) => (
                      <div key={i} className="font-mono text-[11px] text-[#8a8578] truncate">
                        <span className="text-[#e9e4d8]">{img.src}</span>
                        {img.alt && <span> &bull; alt: &ldquo;{img.alt}&rdquo;</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wayback Links */}
              <div className="flex gap-4 pt-1 font-mono text-xs">
                <a
                  href={selectedSite.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#ff9e00] underline hover:opacity-80"
                >
                  View Snapshot &rarr;
                </a>
                <a
                  href={selectedSite.rawUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8a8578] underline hover:text-[#e9e4d8]"
                >
                  Raw Snapshot &rarr;
                </a>
              </div>
            </div>

            {/* Séance Terminal Chat */}
            <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 space-y-3">
              <h3 className="font-mono text-xs text-[#ff9e00] tracking-wider uppercase">
                Séance With Digital Ghost
              </h3>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Why did you go dark?',
                  'What are your HTML comments?',
                  'Reconstruct your missing images',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-[#e9e4d8] hover:border-[#ff9e00] hover:text-[#ff9e00] transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Message Window */}
              <div className="bg-[#0c0b0e] border border-[rgba(255,255,255,0.1)] rounded p-3 min-h-[140px] max-h-48 overflow-y-auto font-mono text-xs space-y-2">
                {messages.length === 0 ? (
                  <div className="text-[#8a8578] italic">
                    The ghost of {selectedSite.title} is quiet. Ask a question or click a prompt above to begin the séance.
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={
                        m.role === 'user' ? 'text-[#ff9e00]' : 'text-[#e9e4d8]'
                      }
                    >
                      <span className="text-[#8a8578]">
                        {m.role === 'user' ? '> ' : '# '}
                      </span>
                      {m.content}
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="text-[#8a8578] animate-pulse">
                    # Channeling spectral frequency...
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Speak to the ghost..."
                  className="flex-1 bg-[#0c0b0e] border border-[rgba(255,255,255,0.12)] rounded px-3 py-1.5 text-xs font-mono text-[#e9e4d8] focus:outline-none focus:border-[#ff9e00]"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-3 py-1.5 bg-[#ff9e00] text-black font-mono text-xs font-semibold rounded disabled:opacity-40 hover:bg-[#ffb033] transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
