'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { easing } from 'maath';
import type { Site } from '@/types/archive';
import { getCaseTexture } from './TextureFactory';
import { closetStore, interaction, useClosetStore } from './useClosetStore';
import { CASE, type Slot } from './closetLayout';
import { sound } from '@/lib/sound';

// Shared geometry and edge material (cached module-level, never recreated).
export const sharedCaseGeometry = new THREE.BoxGeometry(CASE.w, CASE.h, CASE.d);

export const sharedDarkMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.6,
  metalness: 0.05,
});

const edgeMaterial = new THREE.MeshStandardMaterial({
  color: '#121116',
  roughness: 0.35,
  metalness: 0.2,
});

const MARIGOLD = new THREE.Color('#ff9e00');
const HOLD_OFFSET = new THREE.Vector3(-0.15, -0.01, -0.6);
const tmpTarget = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

interface CaseMeshProps {
  site: Site;
  slot: Slot;
}

function makeFaceMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#2a2830',
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    emissive: MARIGOLD,
    emissiveIntensity: 0,
  });
}

export function CaseMesh({ site, slot }: CaseMeshProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const selectedSiteId = useClosetStore((s) => s.selectedSiteId);
  const isGlowing = useClosetStore((s) => s.searchGlowIds.includes(site.id));
  const isHovered = useClosetStore((s) => s.hoveredSiteId === site.id);
  const isSelected = selectedSiteId === site.id;
  const isAnotherSelected = selectedSiteId !== null && !isSelected;

  const shadeRef = useRef({ value: 1, glow: 0 });

  const faces = useMemo(
    () => ({ spine: makeFaceMaterial(), cover: makeFaceMaterial(), back: makeFaceMaterial() }),
    []
  );

  // Box face order: +X (front cover), -X (back cover), +Y, -Y, +Z (spine), -Z.
  const materials = useMemo(
    () => [faces.cover, faces.back, edgeMaterial, edgeMaterial, faces.spine, edgeMaterial],
    [faces]
  );

  useEffect(() => {
    let active = true;
    (['spine', 'cover', 'back'] as const).forEach((kind) => {
      void getCaseTexture(site, kind, gl).then((tex) => {
        if (!active) return;
        const mat = faces[kind];
        mat.map = tex;
        mat.color.set('#ffffff');
        mat.needsUpdate = true;
      });
    });
    return () => {
      active = false;
    };
  }, [site, gl, faces]);

  useEffect(
    () => () => {
      faces.spine.dispose();
      faces.cover.dispose();
      faces.back.dispose();
    },
    [faces]
  );

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const [ox, , oz] = slot.outward;
    const [px, py, pz] = slot.position;

    if (isSelected) {
      tmpTarget.copy(HOLD_OFFSET);
      state.camera.localToWorld(tmpTarget);
      easing.damp3(mesh.position, tmpTarget, 0.22, dt);

      if (!interaction.draggingCase) {
        interaction.spin += interaction.spinVelocity * dt;
        interaction.spinVelocity *= Math.exp(-3 * dt);
      }
      // +X (front cover) faces the camera when yaw = cameraYaw - PI/2.
      tmpEuler.set(0, state.camera.rotation.y - Math.PI / 2 + interaction.spin, 0);
      easing.dampE(mesh.rotation, tmpEuler, 0.25, dt);
    } else {
      const slide = isGlowing ? 0.09 : isHovered && !isAnotherSelected ? 0.06 : 0;
      tmpTarget.set(px + ox * slide, py, pz + oz * slide);
      easing.damp3(mesh.position, tmpTarget, 0.15, dt);
      tmpEuler.set(slot.rotation[0], slot.rotation[1], slot.rotation[2]);
      easing.dampE(mesh.rotation, tmpEuler, 0.2, dt);
    }

    // Dim the rest of the shelf while a case is held; pulse search matches in marigold.
    const shade = shadeRef.current;
    easing.damp(shade, 'value', isAnotherSelected ? 0.35 : 1, 0.25, dt);
    const pulse = isGlowing && !isSelected ? 0.55 + 0.3 * Math.sin(state.clock.elapsedTime * 3.2) : 0;
    easing.damp(shade, 'glow', pulse, 0.12, dt);
    for (const mat of [faces.spine, faces.cover, faces.back]) {
      if (mat.map) mat.color.setScalar(shade.value);
      mat.emissiveIntensity = shade.glow;
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isAnotherSelected) return;
    closetStore.setHoveredSite(site);
    document.body.style.cursor = isSelected ? 'grab' : 'pointer';
    if (!isSelected) sound.tick();
  };

  const handlePointerOut = () => {
    if (closetStore.getState().hoveredSiteId === site.id) closetStore.setHoveredSite(null);
    document.body.style.cursor = '';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6 || isSelected) return;
    sound.pull();
    closetStore.setHoveredSite(null);
    closetStore.selectSite(site);
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isSelected) return;
    e.stopPropagation();
    interaction.draggingCase = true;
    document.body.style.cursor = 'grabbing';
  };

  return (
    <mesh
      ref={meshRef}
      geometry={sharedCaseGeometry}
      material={materials}
      position={slot.position}
      rotation={slot.rotation}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    />
  );
}
