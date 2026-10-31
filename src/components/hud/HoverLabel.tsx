'use client';

import React, { useEffect, useRef } from 'react';
import { useClosetStore } from '@/components/closet/useClosetStore';
import { spineNumber } from '@/components/closet/TextureFactory';

/** Small caption that trails the cursor while it rests on a spine. */
export function HoverLabel() {
  const site = useClosetStore((s) => s.hoveredSite);
  const selected = useClosetStore((s) => s.selectedSiteId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 16}px)`;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div ref={ref} className="pointer-events-none fixed left-0 top-0 z-30">
      {site && !selected && (
        <div className="pill rounded-xl! px-3.5 py-2 max-w-[280px]">
          <p className="font-mono text-[10px] text-marigold">
            {spineNumber(site.spine)} · {site.firstCaptured}–{site.lastCaptured}
          </p>
          <p className="font-display text-[19px] leading-tight text-ink">{site.title}</p>
          <p className="font-mono text-[10px] text-muted truncate">{site.url}</p>
        </div>
      )}
    </div>
  );
}
