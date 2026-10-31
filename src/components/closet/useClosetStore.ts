import { useSyncExternalStore } from 'react';
import type { Site } from '@/types/archive';

export interface ClosetState {
  selectedSiteId: string | null;
  hoveredSiteId: string | null;
  selectedSite: Site | null;
  hoveredSite: Site | null;
  searchGlowIds: string[];
  entered: boolean;
}

type Listener = () => void;

let state: ClosetState = {
  selectedSiteId: null,
  hoveredSiteId: null,
  selectedSite: null,
  hoveredSite: null,
  searchGlowIds: [],
  entered: false,
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Per-frame interaction values. Mutated by pointer handlers and read inside
 * useFrame, so they never trigger React renders.
 */
export const interaction = {
  spin: 0,
  spinVelocity: 0,
  draggingCase: false,
  /** Pixels moved since the last pointerdown; separates clicks from drags. */
  dragDistance: 0,
};

export const closetStore = {
  getState(): ClosetState {
    return state;
  },

  selectSite(site: Site | null) {
    interaction.spin = 0;
    interaction.spinVelocity = 0;
    state = {
      ...state,
      selectedSite: site,
      selectedSiteId: site ? site.id : null,
    };
    emitChange();
  },

  deselectSite() {
    if (state.selectedSiteId !== null) {
      state = {
        ...state,
        selectedSite: null,
        selectedSiteId: null,
      };
      emitChange();
    }
  },

  setHoveredSite(site: Site | null) {
    const id = site ? site.id : null;
    if (state.hoveredSiteId !== id) {
      state = {
        ...state,
        hoveredSiteId: id,
        hoveredSite: site,
      };
      emitChange();
    }
  },

  setSearchGlowIds(ids: string[]) {
    state = {
      ...state,
      searchGlowIds: ids,
    };
    emitChange();
  },

  enter() {
    if (!state.entered) {
      state = { ...state, entered: true };
      emitChange();
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * React hook to subscribe to closet store state slices.
 */
export function useClosetStore<T>(selector: (state: ClosetState) => T): T {
  return useSyncExternalStore(
    closetStore.subscribe,
    () => selector(closetStore.getState()),
    () => selector(closetStore.getState())
  );
}
