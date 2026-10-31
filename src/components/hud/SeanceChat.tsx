'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Site } from '@/types/archive';
import { speak, stopSpeaking } from '@/lib/voice';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  mode?: 'chat' | 'reconstruct';
  error?: boolean;
}

const CHIPS: { label: string; prompt: string; mode: 'chat' | 'reconstruct' }[] = [
  { label: 'Who were you?', prompt: 'Who were you, and who did you exist for?', mode: 'chat' },
  { label: 'Your HTML comments', prompt: 'What did you leave hidden in your HTML comments?', mode: 'chat' },
  { label: 'Why did you go quiet?', prompt: 'Why did you go quiet?', mode: 'chat' },
  { label: 'Reconstruct lost images', prompt: 'Reconstruct your missing images for me.', mode: 'reconstruct' },
];

const LISTENING = [
  'The medium is listening…',
  'Reading the HTML by candlelight…',
  'Something stirs in the source code…',
  'Waiting for the spirit to answer…',
];

/** Wraps "quoted" fragments so verbatim quotes from the snapshot stand out. */
function renderGhostText(text: string): React.ReactNode[] {
  return text.split(/("[^"]+")/g).map((part, i) =>
    part.startsWith('"') && part.endsWith('"') ? (
      <span key={i} className="text-marigold">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

interface SeanceChatProps {
  site: Site;
  /** Sent with the request when the site is not in the shelved archive (a live resurrection). */
  ephemeral?: boolean;
  compact?: boolean;
}

export function SeanceChat({ site, ephemeral = false, compact = false }: SeanceChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingFirstToken, setWaitingFirstToken] = useState(false);
  const [listenIdx, setListenIdx] = useState(0);
  const [trance, setTrance] = useState(0);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, waitingFirstToken]);

  useEffect(() => {
    if (!waitingFirstToken) return;
    const id = window.setInterval(() => setListenIdx((i) => (i + 1) % LISTENING.length), 2400);
    return () => window.clearInterval(id);
  }, [waitingFirstToken]);

  useEffect(() => () => stopSpeaking(), []);

  async function ask(text: string, mode: 'chat' | 'reconstruct') {
    const content = text.trim();
    if (!content || busy) return;
    const history: ChatMessage[] = [...messages.filter((m) => !m.error), { role: 'user', content, mode }];
    setMessages([...messages, { role: 'user', content, mode }]);
    setInput('');
    setBusy(true);
    setWaitingFirstToken(true);
    setTrance(0);

    try {
      const res = await fetch('/api/seance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          mode,
          messages: history.map(({ role, content: c }) => ({ role, content: c })).slice(-6),
          site: ephemeral ? site : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const reason = await res.text().catch(() => '');
        setMessages((prev) => [...prev, { role: 'assistant', content: reason || 'The candle went out.', error: true }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      let started = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const marks = chunk.split('\u0001').length - 1;
        if (marks > 0) setTrance((t) => t + marks);
        reply += chunk.replaceAll('\u0001', '');
        if (!started && reply.trim()) {
          started = true;
          setWaitingFirstToken(false);
          setMessages((prev) => [...prev, { role: 'assistant', content: reply, mode }]);
        } else if (started) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: reply, mode };
            return next;
          });
        }
      }
      if (!started) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Only static came back. Ask again.', error: true }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'The connection to the other side dropped. Try again.', error: true },
      ]);
    } finally {
      setBusy(false);
      setWaitingFirstToken(false);
    }
  }

  function toggleSpeak(idx: number, text: string) {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(idx);
    void speak(text).finally(() => setSpeakingIdx((cur) => (cur === idx ? null : cur)));
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={busy}
            onClick={() => void ask(chip.prompt, chip.mode)}
            className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-hairline bg-white/[0.03] text-ink hover:border-marigold hover:text-marigold transition-colors disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={`crt rounded-lg border border-hairline p-4 overflow-y-auto thin-scroll font-mono text-[12.5px] leading-relaxed space-y-3 ${
          compact ? 'min-h-[220px] max-h-[340px]' : 'min-h-[260px] flex-1'
        }`}
      >
        {messages.length === 0 && !busy && (
          <p className="text-muted italic">
            The ghost of {site.title} is quiet. Ask it something, or pick a question above. It can only remember what
            survived in its snapshot.
          </p>
        )}
        {messages.map((m, idx) =>
          m.role === 'user' ? (
            <p key={idx} className="text-muted">
              <span className="text-marigold/80">you › </span>
              {m.content}
            </p>
          ) : (
            <div key={idx} className={m.error ? 'text-[#d98b6b]' : 'ghost-text'}>
              {m.mode === 'reconstruct' && !m.error && (
                <span className="block text-[10px] tracking-[0.18em] text-muted mb-1">IMAGINED, NOT REMEMBERED</span>
              )}
              <p className={busy && idx === messages.length - 1 ? 'caret' : ''}>
                {m.error ? m.content : renderGhostText(m.content)}
              </p>
              {!m.error && !(busy && idx === messages.length - 1) && (
                <button
                  type="button"
                  onClick={() => toggleSpeak(idx, m.content)}
                  className="mt-1.5 text-[10px] tracking-[0.14em] text-muted hover:text-marigold"
                >
                  {speakingIdx === idx ? '■ STOP VOICE' : '▶ HEAR THE GHOST'}
                </button>
              )}
            </div>
          )
        )}
        {waitingFirstToken && (
          <div className="text-muted">
            <p className="flicker">{LISTENING[listenIdx]}</p>
            {trance > 0 && (
              <p className="mt-1 text-[10px] tracking-[0.14em]">
                <span className="text-marigold/80">{'·'.repeat(Math.min(48, Math.ceil(trance / 2)))}</span> GEMMA IS
                THINKING ({trance})
              </p>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input, 'chat');
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak to the ghost…"
          className="flex-1 min-w-0 bg-black/40 border border-hairline rounded-full px-4 py-2 text-[13px] font-mono text-ink placeholder:text-muted focus:outline-none focus:border-marigold"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-full bg-marigold text-[#0c0b0e] font-mono text-[12px] font-bold disabled:opacity-40 hover:brightness-110"
        >
          Ask
        </button>
      </form>
      <p className="font-mono text-[10px] text-muted leading-snug">
        Replies are AI-generated by an open-weight Gemma model, grounded only in this site&apos;s archived HTML. Quoted
        text in <span className="text-marigold">marigold</span> should appear verbatim in the snapshot.
      </p>
    </div>
  );
}
