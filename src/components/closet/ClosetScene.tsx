'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { easing } from 'maath';
import type { Site } from '@/types/archive';
import { ClosetRoom } from './ClosetRoom';
import { closetStore, useClosetStore } from './useClosetStore';

function RendererInfoLogger() {
  const { gl } = useThree();
  const loggedRef = useRef(false);

  useFrame(() => {
    if (!loggedRef.current && gl.info.render.frame > 4) {
      loggedRef.current = true;
      console.log('Renderer Info:', {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
      });
    }
  });

  return null;
}

/**
 * Handles camera FOV zoom (between 62 and 30) via scroll wheel
 * and camera Y movement (between -0.4 and 0.5) via W/S or Arrow keys.
 * Also handles Esc key to put the case back.
 */
function CameraController() {
  const targetFovRef = useRef(50);
  const targetCameraYRef = useRef(0.1);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Zoom by damping camera fov between 62 and 30
      const delta = e.deltaY * 0.035;
      targetFovRef.current = Math.min(62, Math.max(30, targetFovRef.current + delta));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input, ignore
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        targetCameraYRef.current = Math.min(
          0.5,
          targetCameraYRef.current + 0.08
        );
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        targetCameraYRef.current = Math.max(
          -0.4,
          targetCameraYRef.current - 0.08
        );
      } else if (e.key === 'Escape') {
        closetStore.deselectSite();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useFrame((state, delta) => {
    // 1. Damp camera FOV between 62 and 30
    const camera = state.camera as THREE.PerspectiveCamera;
    if (camera.isPerspectiveCamera) {
      easing.damp(camera, 'fov', targetFovRef.current, 0.2, delta);
      camera.updateProjectionMatrix();
    }

    // 2. Damp camera Y position between -0.4 and 0.5
    easing.damp(state.camera.position, 'y', targetCameraYRef.current, 0.2, delta);
  });

  return null;
}

/**
 * Cursor Flashlight:
 * SpotLight (angle 0.48, penumbra 0.85, intensity ~3)
 * Target follows the pointer ray intersection with the shelf plane, damped.
 */
function CursorFlashlight() {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!spotLightRef.current) return;

    // Pointer is in [-1, 1] normalized coordinates
    // Intersect pointer ray with shelf plane (approx Z = -0.45)
    const targetX = state.pointer.x * 0.7;
    const targetY = state.camera.position.y + state.pointer.y * 0.55;
    const targetZ = -0.45;

    easing.damp3(targetObj.position, [targetX, targetY, targetZ], 0.12, delta);
    targetObj.updateMatrixWorld();

    // Flashlight origin stays near the camera, slightly above
    easing.damp3(
      spotLightRef.current.position,
      [
        state.camera.position.x + state.pointer.x * 0.08,
        state.camera.position.y + 0.05,
        state.camera.position.z,
      ],
      0.12,
      delta
    );
  });

  return (
    <>
      <primitive object={targetObj} />
      <spotLight
        ref={spotLightRef}
        target={targetObj}
        angle={0.48}
        penumbra={0.85}
        intensity={3.0}
        color="#fff4e6"
        distance={4.5}
        decay={2}
      />
    </>
  );
}

interface ClosetSceneProps {
  sites: Site[];
}

export default function ClosetScene({ sites }: ClosetSceneProps) {
  const selectedSiteId = useClosetStore((s) => s.selectedSiteId);

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.1, 1.35], fov: 50 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        onPointerMissed={() => {
          // Click-away puts selected case back
          if (selectedSiteId) {
            closetStore.deselectSite();
          }
        }}
      >
        {/* OrbitControls for gentle drag-to-look (disabled while dragging a selected case) */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.35}
          minAzimuthAngle={-Math.PI / 8}
          maxAzimuthAngle={Math.PI / 8}
          minPolarAngle={Math.PI / 2 - 0.18}
          maxPolarAngle={Math.PI / 2 + 0.18}
          target={[0, 0.05, 0]}
        />

        {/* Dynamic camera zoom and height controller */}
        <CameraController />

        {/* Cursor Flashlight following pointer ray intersection with shelf plane */}
        <CursorFlashlight />

        {/* 3D Closet Room with Shelves & Cases */}
        <ClosetRoom sites={sites} />

        {/* Logger for acceptance criteria */}
        <RendererInfoLogger />

        {/* Postprocessing: Bloom, Vignette 0.65, Noise 0.03 */}
        <EffectComposer enableNormalPass={false}>
          <Bloom
            luminanceThreshold={0.55}
            luminanceSmoothing={0.85}
            intensity={0.4}
            mipmapBlur
          />
          <Vignette darkness={0.65} offset={0.3} />
          <Noise opacity={0.03} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
