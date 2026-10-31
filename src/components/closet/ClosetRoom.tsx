'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Site } from '@/types/archive';
import { CaseMesh, sharedCaseGeometry, sharedDarkMaterial } from './CaseMesh';
import { buildLayout, ROOM, SHELF } from './closetLayout';
import { Ofrenda } from './Ofrenda';
import { hashString } from './TextureFactory';

const wallMaterial = new THREE.MeshStandardMaterial({ color: '#1d1820', roughness: 0.95 });
const floorMaterial = new THREE.MeshStandardMaterial({ color: '#21170f', roughness: 0.75 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: '#141116', roughness: 1 });
const shelfMaterial = new THREE.MeshStandardMaterial({ color: '#3a281b', roughness: 0.62 });
const shelfEdgeMaterial = new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: 0.5 });

const BLANK_TONES = ['#1f1c22', '#26211c', '#1b1e23', '#2b2326', '#211f1a', '#18171c', '#2d2822', '#232026'];

let blankTexture: THREE.CanvasTexture | null = null;

/** One shared, text-free spine texture for every unlabeled case (instance colour tints it). */
function getBlankTexture(): THREE.CanvasTexture {
  if (blankTexture) return blankTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d8d4cc';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 6, 256);
    ctx.fillRect(58, 0, 6, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(14, 22, 36, 3);
    ctx.fillRect(14, 226, 36, 2);
  }
  blankTexture = new THREE.CanvasTexture(canvas);
  blankTexture.colorSpace = THREE.SRGBColorSpace;
  return blankTexture;
}

interface ClosetRoomProps {
  sites: Site[];
  resurrectedFrom: number;
}

/** Engraved brass label rail hung under a wall's top plank. */
function Plaque({ text, position, rotationY }: { text: string; position: [number, number, number]; rotationY: number }) {
  const material = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 112);
      g.addColorStop(0, '#d8b46a');
      g.addColorStop(0.5, '#b58c45');
      g.addColorStop(1, '#8a6630');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 112);
      ctx.strokeStyle = 'rgba(40,24,8,0.6)';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 1008, 96);
      ctx.fillStyle = '#2b1a0a';
      const mono = getComputedStyle(document.documentElement).getPropertyValue('--nf-mono').trim() || 'monospace';
      ctx.font = `700 40px ${mono}, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 512, 60);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 });
  }, [text]);

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} material={material}>
      <planeGeometry args={[0.46, 0.05]} />
    </mesh>
  );
}

function ShelfUnit({ wall }: { wall: 'left' | 'back' | 'right' }) {
  const isBack = wall === 'back';
  const length = isBack ? ROOM.halfWidth * 2 : ROOM.frontZ - ROOM.backZ - SHELF.depth;
  const planks = [...SHELF.rowsY, SHELF.topY];
  const sign = wall === 'left' ? -1 : 1;

  const group = isBack
    ? { position: [0, 0, ROOM.backZ + SHELF.depth / 2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }
    : {
        position: [sign * (ROOM.halfWidth - SHELF.depth / 2), 0, (ROOM.backZ + SHELF.depth + ROOM.frontZ) / 2] as [number, number, number],
        rotation: [0, -sign * (Math.PI / 2), 0] as [number, number, number],
      };

  return (
    <group position={group.position} rotation={group.rotation}>
      {planks.map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0]} material={shelfMaterial}>
            <boxGeometry args={[length, SHELF.thickness, SHELF.depth]} />
          </mesh>
          <mesh position={[0, y, SHELF.depth / 2]} material={shelfEdgeMaterial}>
            <boxGeometry args={[length, SHELF.thickness + 0.006, 0.008]} />
          </mesh>
        </group>
      ))}
      {[-length / 2, length / 2].map((x) => (
        <mesh key={x} position={[x, (SHELF.rowsY[0] + SHELF.topY) / 2, 0]} material={shelfMaterial}>
          <boxGeometry args={[0.03, SHELF.topY - SHELF.rowsY[0] + 0.04, SHELF.depth]} />
        </mesh>
      ))}
    </group>
  );
}

export function ClosetRoom({ sites, resurrectedFrom }: ClosetRoomProps) {
  const blankMeshRef = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => buildLayout(sites, resurrectedFrom), [sites, resurrectedFrom]);
  const plaqueY = SHELF.topY - SHELF.thickness / 2 - 0.028;
  const sideX = ROOM.halfWidth - SHELF.depth - 0.004;
  const blankMaterial = useMemo(() => {
    const mat = sharedDarkMaterial.clone();
    mat.map = getBlankTexture();
    return mat;
  }, []);

  useLayoutEffect(() => {
    const mesh = blankMeshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    layout.blanks.forEach((slot, idx) => {
      dummy.position.set(...slot.position);
      dummy.rotation.set(...slot.rotation);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      const h = hashString(`${slot.wall}${slot.row}${slot.col}`);
      color.set(BLANK_TONES[h % BLANK_TONES.length]);
      mesh.setColorAt(idx, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [layout]);

  const width = ROOM.halfWidth * 2;
  const depth = ROOM.frontZ - ROOM.backZ;
  const height = ROOM.ceilingY - ROOM.floorY;
  const midY = (ROOM.ceilingY + ROOM.floorY) / 2;
  const midZ = (ROOM.frontZ + ROOM.backZ) / 2;

  return (
    <group>
      <mesh position={[0, midY, ROOM.backZ]} material={wallMaterial}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position={[-ROOM.halfWidth, midY, midZ]} rotation={[0, Math.PI / 2, 0]} material={wallMaterial}>
        <planeGeometry args={[depth, height]} />
      </mesh>
      <mesh position={[ROOM.halfWidth, midY, midZ]} rotation={[0, -Math.PI / 2, 0]} material={wallMaterial}>
        <planeGeometry args={[depth, height]} />
      </mesh>
      <mesh position={[0, ROOM.floorY, midZ]} rotation={[-Math.PI / 2, 0, 0]} material={floorMaterial}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh position={[0, ROOM.ceilingY, midZ]} rotation={[Math.PI / 2, 0, 0]} material={ceilingMaterial}>
        <planeGeometry args={[width, depth]} />
      </mesh>

      <ShelfUnit wall="back" />
      <ShelfUnit wall="left" />
      <ShelfUnit wall="right" />

      <Plaque text="DOT-COMS · PORTALS · SEARCH ENGINES" position={[0, plaqueY, ROOM.backZ + SHELF.depth + 0.004]} rotationY={0} />
      <Plaque text="GEOCITIES · AREA51 NEIGHBORHOOD" position={[-sideX, plaqueY, 0.05]} rotationY={Math.PI / 2} />
      <Plaque text="RESURRECTED TONIGHT" position={[sideX, plaqueY, 0.05]} rotationY={-Math.PI / 2} />

      {layout.real.map(({ site, slot }) => (
        <CaseMesh key={site.id} site={site} slot={slot} />
      ))}

      {layout.blanks.length > 0 && (
        <instancedMesh
          key={layout.blanks.length}
          ref={blankMeshRef}
          args={[sharedCaseGeometry, blankMaterial, layout.blanks.length]}
        />
      )}

      <Ofrenda />
    </group>
  );
}
