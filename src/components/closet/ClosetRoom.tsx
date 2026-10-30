'use client';

import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Site } from '@/types/archive';
import {
  CaseMesh,
  CASE_HEIGHT,
  CASE_DEPTH,
  sharedCaseGeometry,
  sharedDarkMaterial,
} from './CaseMesh';

// Configurable slot grid constants
export const SHELF_ROWS = 3;
export const SLOTS_PER_ROW_BACK = 16;
export const SLOTS_PER_ROW_SIDE = 9;
export const TOTAL_SLOTS =
  SHELF_ROWS * (SLOTS_PER_ROW_BACK + 2 * SLOTS_PER_ROW_SIDE);

export const ROOM_WIDTH = 1.35;
export const ROOM_DEPTH = 1.35;
export const ROOM_HEIGHT = 1.8;

// Shared room and shelf materials (dark walnut / charcoal)
const roomWallMaterial = new THREE.MeshStandardMaterial({
  color: '#131217',
  roughness: 0.9,
  metalness: 0.1,
});

const shelfPlankMaterial = new THREE.MeshStandardMaterial({
  color: '#1c1a22',
  roughness: 0.8,
  metalness: 0.2,
});

interface SlotInfo {
  position: [number, number, number];
  rotation: [number, number, number];
}

interface ClosetRoomProps {
  sites: Site[];
}

export function ClosetRoom({ sites }: ClosetRoomProps) {
  const blankMeshRef = useRef<THREE.InstancedMesh>(null);

  // Compute all slot positions across 3 rows and 3 walls (left, back, right)
  const allSlots = useMemo(() => {
    const slots: SlotInfo[] = [];
    const rowYHeights = [-0.34, 0.04, 0.42];
    const shelfYOffset = 0.02; // plank thickness

    for (let r = 0; r < SHELF_ROWS; r++) {
      const caseY = rowYHeights[r] + shelfYOffset / 2 + CASE_HEIGHT / 2;

      // 1. Left Wall (z runs from front to back: facing +X)
      const leftX = -ROOM_WIDTH / 2 + CASE_DEPTH / 2 + 0.02;
      const leftZStart = ROOM_DEPTH / 2 - 0.25;
      const leftZEnd = -ROOM_DEPTH / 2 + 0.25;
      for (let i = 0; i < SLOTS_PER_ROW_SIDE; i++) {
        const t = i / (SLOTS_PER_ROW_SIDE - 1);
        const z = leftZStart + t * (leftZEnd - leftZStart);
        slots.push({
          position: [leftX, caseY, z],
          rotation: [0, Math.PI / 2, 0], // face +X
        });
      }

      // 2. Back Wall (x runs from left to right: facing +Z)
      const backZ = -ROOM_DEPTH / 2 + CASE_DEPTH / 2 + 0.02;
      const backXStart = -ROOM_WIDTH / 2 + 0.25;
      const backXEnd = ROOM_WIDTH / 2 - 0.25;
      for (let i = 0; i < SLOTS_PER_ROW_BACK; i++) {
        const t = i / (SLOTS_PER_ROW_BACK - 1);
        const x = backXStart + t * (backXEnd - backXStart);
        slots.push({
          position: [x, caseY, backZ],
          rotation: [0, 0, 0], // face +Z
        });
      }

      // 3. Right Wall (z runs from back to front: facing -X)
      const rightX = ROOM_WIDTH / 2 - CASE_DEPTH / 2 - 0.02;
      const rightZStart = -ROOM_DEPTH / 2 + 0.25;
      const rightZEnd = ROOM_DEPTH / 2 - 0.25;
      for (let i = 0; i < SLOTS_PER_ROW_SIDE; i++) {
        const t = i / (SLOTS_PER_ROW_SIDE - 1);
        const z = rightZStart + t * (rightZEnd - rightZStart);
        slots.push({
          position: [rightX, caseY, z],
          rotation: [0, -Math.PI / 2, 0], // face -X
        });
      }
    }

    return slots;
  }, []);

  // Split slots into real sites and remaining blank slots
  const realSitesCount = Math.min(sites.length, allSlots.length);
  const realSitesList = sites.slice(0, realSitesCount);
  const blankSlots = useMemo(
    () => allSlots.slice(realSitesCount),
    [allSlots, realSitesCount]
  );

  // Setup instanced mesh transforms for all blank uniform dark cases
  useLayoutEffect(() => {
    if (!blankMeshRef.current || blankSlots.length === 0) return;

    const dummy = new THREE.Object3D();
    blankSlots.forEach((slot, idx) => {
      dummy.position.set(...slot.position);
      dummy.rotation.set(...slot.rotation);
      dummy.updateMatrix();
      blankMeshRef.current?.setMatrixAt(idx, dummy.matrix);
    });

    blankMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [blankSlots]);

  return (
    <group>
      {/* Fog in #0c0b0e */}
      <fogExp2 attach="fog" args={['#0c0b0e', 0.42]} />

      {/* Two warm strip lights (#ffdfb0, low intensity) */}
      <pointLight
        position={[-ROOM_WIDTH / 3, ROOM_HEIGHT / 2 - 0.15, -0.1]}
        color="#ffdfb0"
        intensity={1.7}
        distance={2.8}
        decay={2}
      />
      <pointLight
        position={[ROOM_WIDTH / 3, ROOM_HEIGHT / 2 - 0.15, -0.1]}
        color="#ffdfb0"
        intensity={1.7}
        distance={2.8}
        decay={2}
      />

      {/* Soft ambient and fill lighting */}
      <ambientLight color="#2a2732" intensity={0.5} />
      <directionalLight
        position={[0, 0.8, 1.2]}
        color="#ffe8d1"
        intensity={0.6}
      />

      {/* U-Shaped Room Architecture (Left, Back, Right Walls, Floor, Ceiling) */}
      <group>
        {/* Back Wall */}
        <mesh
          position={[0, 0, -ROOM_DEPTH / 2]}
          material={roomWallMaterial}
          receiveShadow
        >
          <planeGeometry args={[ROOM_WIDTH, ROOM_HEIGHT]} />
        </mesh>

        {/* Left Wall */}
        <mesh
          position={[-ROOM_WIDTH / 2, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          material={roomWallMaterial}
          receiveShadow
        >
          <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        </mesh>

        {/* Right Wall */}
        <mesh
          position={[ROOM_WIDTH / 2, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          material={roomWallMaterial}
          receiveShadow
        >
          <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        </mesh>

        {/* Floor */}
        <mesh
          position={[0, -ROOM_HEIGHT / 2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={roomWallMaterial}
          receiveShadow
        >
          <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        </mesh>

        {/* Ceiling */}
        <mesh
          position={[0, ROOM_HEIGHT / 2, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={roomWallMaterial}
        >
          <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        </mesh>
      </group>

      {/* 3 Rows of Wooden Shelf Planks */}
      <group>
        {[-0.34, 0.04, 0.42].map((shelfY, r) => (
          <group key={`shelf-row-${r}`}>
            {/* Back shelf plank */}
            <mesh
              position={[0, shelfY, -ROOM_DEPTH / 2 + 0.12]}
              material={shelfPlankMaterial}
              receiveShadow
            >
              <boxGeometry args={[ROOM_WIDTH - 0.08, 0.02, 0.24]} />
            </mesh>
            {/* Left shelf plank */}
            <mesh
              position={[-ROOM_WIDTH / 2 + 0.12, shelfY, 0]}
              material={shelfPlankMaterial}
              receiveShadow
            >
              <boxGeometry args={[0.24, 0.02, ROOM_DEPTH - 0.08]} />
            </mesh>
            {/* Right shelf plank */}
            <mesh
              position={[ROOM_WIDTH / 2 - 0.12, shelfY, 0]}
              material={shelfPlankMaterial}
              receiveShadow
            >
              <boxGeometry args={[0.24, 0.02, ROOM_DEPTH - 0.08]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Real sites rendered as individual CaseMesh instances */}
      <group>
        {realSitesList.map((site, index) => {
          const slot = allSlots[index];
          return (
            <CaseMesh
              key={site.id}
              site={site}
              position={slot.position}
              rotation={slot.rotation}
            />
          );
        })}
      </group>

      {/* Remaining empty slots filled with BLANK uniform dark cases via single InstancedMesh */}
      {blankSlots.length > 0 && (
        <instancedMesh
          ref={blankMeshRef}
          args={[sharedCaseGeometry, sharedDarkMaterial, blankSlots.length]}
          receiveShadow
        />
      )}
    </group>
  );
}
