import { useSyncExternalStore } from 'react';
import type { Site } from '@/types/archive';

export interface ClosetState {
  selectedSiteId: string | null;
  hoveredSiteId: string | null;
  selectedSite: Site | null;
  searchGlowIds: string[];
}

type Listener = () => void;

let state: ClosetState = {
  selectedSiteId: null,
  hoveredSiteId: null,
  selectedSite: null,
  searchGlowIds: [],
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const closetStore = {
  getState(): ClosetState {
    return state;
  },

  selectSite(site: Site | null) {
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

  setHoveredSite(id: string | null) {
    if (state.hoveredSiteId !== id) {
      state = {
        ...state,
        hoveredSiteId: id,
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

