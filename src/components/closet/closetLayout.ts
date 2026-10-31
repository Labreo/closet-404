import type { Site } from '@/types/archive';
import { hashString } from './TextureFactory';

export const ROOM = {
  halfWidth: 1.2,
  backZ: -1.1,
  frontZ: 1.1,
  floorY: -1.0,
  ceilingY: 1.3,
};

export const CASE = { w: 0.042, h: 0.28, d: 0.2 };

export const SHELF = {
  depth: 0.26,
  thickness: 0.022,
  rowsY: [-0.78, -0.4, -0.02, 0.36],
  /** Top plank that holds the ofrenda: candles and cempasúchil. */
  topY: 0.7,
};

const PITCH = 0.047;
const BACK_X = [-0.92, 0.92] as const;
const SIDE_Z = [-0.82, 0.75] as const;

export type Wall = 'left' | 'back' | 'right';

export interface Slot {
  wall: Wall;
  row: number;
  col: number;
  position: [number, number, number];
  rotation: [number, number, number];
  outward: [number, number, number];
}

function caseY(row: number): number {
  return SHELF.rowsY[row] + SHELF.thickness / 2 + CASE.h / 2;
}

function makeSlot(wall: Wall, row: number, col: number): Slot {
  const y = caseY(row);
  if (wall === 'back') {
    const x = BACK_X[0] + col * PITCH;
    return {
      wall,
      row,
      col,
      position: [x, y, ROOM.backZ + 0.02 + CASE.d / 2],
      rotation: [0, 0, 0],
      outward: [0, 0, 1],
    };
  }
  const z = SIDE_Z[0] + col * PITCH;
  const sign = wall === 'left' ? 1 : -1;
  return {
    wall,
    row,
    col,
    position: [sign * (-ROOM.halfWidth + 0.02 + CASE.d / 2), y, z],
    rotation: [0, sign * (Math.PI / 2), 0],
    outward: [sign, 0, 0],
  };
}

export const BACK_COLS = Math.floor((BACK_X[1] - BACK_X[0]) / PITCH) + 1;
export const SIDE_COLS = Math.floor((SIDE_Z[1] - SIDE_Z[0]) / PITCH) + 1;

function colsFor(wall: Wall): number {
  return wall === 'back' ? BACK_COLS : SIDE_COLS;
}

export interface ClosetLayout {
  real: { site: Site; slot: Slot }[];
  blanks: Slot[];
}

/**
 * The closet is curated by wall: GeoCities homepages share the left wall (the
 * Area51 neighbourhood), everything else lines the back wall at eye level, and
 * sites resurrected during this visit appear on the right. Every other slot is
 * an unlabeled, unclickable blank case (or a gap with a neighbour leaning in).
 */
export function buildLayout(sites: Site[], resurrectedFrom = sites.length): ClosetLayout {
  const taken = new Set<string>();
  const key = (wall: Wall, row: number, col: number) => `${wall}:${row}:${col}`;
  const real: { site: Site; slot: Slot }[] = [];

  const place = (site: Site, wall: Wall, row: number, col: number) => {
    taken.add(key(wall, row, col));
    real.push({ site, slot: makeSlot(wall, row, col) });
  };

  // Loose runs spread across a wall's rows.
  const spread = (wall: Wall, rows: number[], list: Site[]) => {
    const cols = colsFor(wall);
    const perRow = Math.ceil(list.length / rows.length);
    let cursor = 0;
    rows.forEach((row) => {
      const count = Math.min(perRow, list.length - cursor);
      for (let k = 0; k < count; k++) {
        const site = list[cursor++];
        const jitter = (hashString(site.id) % 3) - 1;
        let col = Math.min(cols - 1, Math.max(0, Math.round(((k + 0.5) / count) * cols - 0.5 + jitter)));
        while (taken.has(key(wall, row, col))) col = (col + 1) % cols;
        place(site, wall, row, col);
      }
    });
  };

  // A contiguous run from the middle of one row outwards, like a box set.
  const cluster = (wall: Wall, row: number, list: Site[]) => {
    const cols = colsFor(wall);
    const center = Math.floor(cols / 2) - Math.floor(list.length / 2);
    list.forEach((site, i) => {
      let col = Math.min(cols - 1, Math.max(0, center + i));
      while (taken.has(key(wall, row, col))) col = (col + 1) % cols;
      place(site, wall, row, col);
    });
  };

  const shelved = sites.slice(0, resurrectedFrom);
  spread('back', [2, 3, 1], shelved.filter((s) => s.category !== 'geocities'));
  cluster('left', 2, shelved.filter((s) => s.category === 'geocities'));
  cluster('right', 2, sites.slice(resurrectedFrom));

  const blanks: Slot[] = [];
  for (const wall of ['left', 'back', 'right'] as Wall[]) {
    for (let row = 0; row < SHELF.rowsY.length; row++) {
      let previousWasGap = false;
      for (let col = 0; col < colsFor(wall); col++) {
        if (taken.has(key(wall, row, col))) {
          previousWasGap = false;
          continue;
        }
        const h = hashString(key(wall, row, col));
        if (h % 11 === 0) {
          previousWasGap = true;
          continue;
        }
        const slot = makeSlot(wall, row, col);
        if (previousWasGap) {
          // Lean into the gap left by a missing case (the gap is at the previous column).
          const [px, py, pz] = slot.position;
          slot.rotation = [slot.rotation[0], slot.rotation[1], wall === 'left' ? -0.16 : 0.16];
          slot.position = wall === 'back' ? [px - 0.018, py - 0.004, pz] : [px, py - 0.004, pz - 0.018];
        } else {
          slot.rotation = [slot.rotation[0], slot.rotation[1] + ((h % 7) - 3) * 0.006, 0];
        }
        blanks.push(slot);
        previousWasGap = false;
      }
    }
  }

  return { real, blanks };
}
