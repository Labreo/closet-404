'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { easing } from 'maath';
import type { Site } from '@/types/archive';
import { getSpineTexture } from './TextureFactory';
import { closetStore, useClosetStore } from './useClosetStore';

export const CASE_WIDTH = 0.045;
export const CASE_HEIGHT = 0.26;
export const CASE_DEPTH = 0.18;

// Shared geometry and uniform side materials (cached module-level)
export const sharedCaseGeometry = new THREE.BoxGeometry(
  CASE_WIDTH,
  CASE_HEIGHT,
  CASE_DEPTH
);

export const sharedDarkMaterial = new THREE.MeshStandardMaterial({
  color: '#151419',
  roughness: 0.85,
  metalness: 0.15,
});

interface CaseMeshProps {
  site: Site;
  position: [number, number, number];
  rotation: [number, number, number];
}

export function CaseMesh({ site, position, rotation }: CaseMeshProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const selectedSiteId = useClosetStore((s) => s.selectedSiteId);
  const isSelected = selectedSiteId === site.id;
  const isAnotherSelected = selectedSiteId !== null && !isSelected;

  const isHoveredRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const spinAngleRef = useRef(0);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let active = true;
    void getSpineTexture(site, gl).then((tex) => {
      if (active) {
        setTexture(tex);
      }
    });
    return () => {
      active = false;
    };
  }, [site, gl]);

  // Compute outward normal vector based on shelf slot rotation
  const normalVec = useMemo(() => {
    const rotY = rotation[1];
    if (Math.abs(rotY) < 0.1) {
      return [0, 0, 1]; // back wall: outward is +Z
    } else if (rotY > 0) {
      return [1, 0, 0]; // left wall: outward is +X
    } else {
      return [-1, 0, 0]; // right wall: outward is -X
    }
  }, [rotation]);

  // Create unique spine material instance to allow independent dimming
  const spineMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0,
    });
  }, [texture]);

  const materials = useMemo(() => {
    return [
      sharedDarkMaterial,
      sharedDarkMaterial,
      sharedDarkMaterial,
      sharedDarkMaterial,
      spineMaterial, // +Z spine face
      sharedDarkMaterial,
    ];
  }, [spineMaterial]);

  // Handle damping for position, rotation, and dimming in useFrame (No setState in useFrame)
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. Position target
    const targetPos = new THREE.Vector3();

    if (isSelected) {
      // Fly to in front of camera, offset left
      const cameraY = state.camera.position.y;
      targetPos.set(-0.18, cameraY, 0.88);
    } else if (isHoveredRef.current) {
      // Hover slide out by 0.06 along shelf outward normal
      targetPos.set(
        position[0] + normalVec[0] * 0.06,
        position[1],
        position[2] + normalVec[2] * 0.06
      );
    } else {
      // Rest slot position
      targetPos.set(...position);
    }

    easing.damp3(meshRef.current.position, targetPos, 0.18, delta);

    // 2. Rotation target
    const targetRot = new THREE.Euler();
    if (isSelected) {
      // Face the camera directly + pointer drag spin
      targetRot.set(0, spinAngleRef.current, 0);
    } else {
      targetRot.set(...rotation);
    }

    easing.dampE(meshRef.current.rotation, targetRot, 0.18, delta);

    // 3. Dimming other cases when a case is selected
    const targetOpacity = isAnotherSelected ? 0.35 : 1.0;
    easing.damp(spineMaterial, 'opacity', targetOpacity, 0.2, delta);
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isHoveredRef.current = true;
    closetStore.setHoveredSite(site.id);
    document.body.style.cursor = isSelected ? 'grab' : 'pointer';
  };

  const handlePointerOut = () => {
    isHoveredRef.current = false;
    closetStore.setHoveredSite(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isSelected) {
      spinAngleRef.current = 0;
      closetStore.selectSite(site);
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isSelected) {
      e.stopPropagation();
      isDraggingRef.current = true;
      lastPointerXRef.current = e.clientX;
      document.body.style.cursor = 'grabbing';
    }
  };

  const handlePointerUp = () => {
    if (isSelected) {
      isDraggingRef.current = false;
      document.body.style.cursor = 'grab';
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isSelected && isDraggingRef.current) {
      const dx = e.clientX - lastPointerXRef.current;
      lastPointerXRef.current = e.clientX;
      spinAngleRef.current += dx * 0.015;
    }
  };

  return (
    <mesh
      ref={meshRef}
      geometry={sharedCaseGeometry}
      material={materials}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    />
  );
}
