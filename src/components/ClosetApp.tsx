'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CoronerReport, Site } from '@/types/archive';
import { closetStore, useClosetStore } from '@/components/closet/useClosetStore';
import { IntroGate } from '@/components/hud/IntroGate';
import { TopBar } from '@/components/hud/TopBar';
import { CommandBar } from '@/components/hud/CommandBar';
import { HoverLabel } from '@/components/hud/HoverLabel';
import { SiteDrawer } from '@/components/hud/SiteDrawer';
import { ResurrectModal } from '@/components/hud/ResurrectModal';
import { sound } from '@/lib/sound';

const ClosetScene = dynamic(() => import('@/components/closet/ClosetScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted flicker">
      lighting the candles…
    </div>
  ),
});

interface ClosetAppProps {
  sites: Site[];
  coroner: Record<string, CoronerReport>;
}

export function ClosetApp({ sites, coroner }: ClosetAppProps) {
  const [resurrected, setResurrected] = useState<Site[]>([]);
  const [resurrectOpen, setResurrectOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const selectedSite = useClosetStore((s) => s.selectedSite);
  const entered = useClosetStore((s) => s.entered);

  const allSites = useMemo(() => [...sites, ...resurrected], [sites, resurrected]);

  // Shareable links: /?site=<id> pulls that case off the shelf once the visitor enters.
  useEffect(() => {
    if (!entered) return;
    const id = new URLSearchParams(window.location.search).get('site');
    const site = id ? sites.find((s) => s.id === id) : undefined;
    if (site && !closetStore.getState().selectedSiteId) {
      sound.pull();
      closetStore.selectSite(site);
    }
  }, [entered, sites]);

  const putBack = useCallback(() => {
    sound.putBack();
    closetStore.deselectSite();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || resurrectOpen || !closetStore.getState().entered) return;
      const key = e.key.toLowerCase();
      if (key === 'r') {
        const pick = allSites[Math.floor(Math.random() * allSites.length)];
        if (pick) {
          sound.pull();
          closetStore.selectSite(pick);
        }
      } else if (key === 'u') {
        e.preventDefault();
        setResurrectOpen(true);
      } else if (key === 'm') {
        setMuted((m) => {
          sound.setMuted(!m);
          return !m;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allSites, resurrectOpen]);

  const handleResurrected = useCallback(
    (site: Site) => {
      const exists = allSites.find((s) => s.id === site.id);
      if (exists) {
        closetStore.selectSite(exists);
        return;
      }
      const shelved = { ...site, spine: allSites.length + 1 };
      setResurrected((prev) => [...prev, shelved]);
      setResurrectOpen(false);
      sound.pull();
      closetStore.selectSite(shelved);
    },
    [allSites]
  );

  const isEphemeral = selectedSite ? resurrected.some((s) => s.id === selectedSite.id) : false;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-ink">
      <ClosetScene sites={allSites} resurrectedFrom={sites.length} />

      {entered && (
        <>
          <TopBar
            count={allSites.length}
            muted={muted}
            onToggleMute={() => {
              sound.setMuted(!muted);
              setMuted(!muted);
            }}
            onResurrect={() => setResurrectOpen(true)}
          />
          <CommandBar sites={allSites} hidden={selectedSite !== null} />
          <HoverLabel />
        </>
      )}

      {selectedSite && (
        <SiteDrawer
          key={selectedSite.id}
          site={selectedSite}
          coroner={coroner[selectedSite.id]}
          ephemeral={isEphemeral}
          onClose={putBack}
        />
      )}

      <IntroGate count={sites.length} />
      <ResurrectModal isOpen={resurrectOpen} onClose={() => setResurrectOpen(false)} onResurrected={handleResurrected} />
    </main>
  );
}
