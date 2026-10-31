'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { easing } from 'maath';
import type { Site } from '@/types/archive';
import { ClosetRoom } from './ClosetRoom';
import { closetStore, interaction, useClosetStore } from './useClosetStore';
import { sound } from '@/lib/sound';

const LOOK = { yawMax: 1.15, pitchMin: -0.38, pitchMax: 0.32 };
const HEIGHT = { min: -0.35, max: 0.5 };
const FOV = { min: 28, max: 62, initial: 54 };

/**
 * Drag to look, wheel to zoom (fov), W/S or arrows to crouch/rise, A/D or
 * arrows to turn. Dragging a held case spins it instead of the camera.
 */
function CameraRig() {
  const gl = useThree((state) => state.gl);
  const target = useRef({ yaw: 0, pitch: 0.03, fov: FOV.initial, y: 0.18 });
  const drag = useRef({ active: false, x: 0, y: 0, lastDx: 0 });

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      drag.current = { active: true, x: e.clientX, y: e.clientY, lastDx: 0 };
      interaction.dragDistance = 0;
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.lastDx = dx;
      interaction.dragDistance += Math.abs(dx) + Math.abs(dy);
      if (interaction.draggingCase) {
        interaction.spin += dx * 0.012;
        return;
      }
      const t = target.current;
      // Slower look while zoomed in.
      const zoomScale = t.fov / FOV.initial;
      t.yaw = THREE.MathUtils.clamp(t.yaw + dx * 0.0032 * zoomScale, -LOOK.yawMax, LOOK.yawMax);
      t.pitch = THREE.MathUtils.clamp(t.pitch + dy * 0.0028 * zoomScale, LOOK.pitchMin, LOOK.pitchMax);
    };
    const onUp = () => {
      if (interaction.draggingCase) {
        interaction.spinVelocity = drag.current.lastDx * 0.6;
        interaction.draggingCase = false;
        document.body.style.cursor = '';
      }
      drag.current.active = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = target.current;
      t.fov = THREE.MathUtils.clamp(t.fov + e.deltaY * 0.03, FOV.min, FOV.max);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const t = target.current;
      switch (e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          t.y = Math.min(HEIGHT.max, t.y + 0.1);
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          t.y = Math.max(HEIGHT.min, t.y - 0.1);
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          t.yaw = Math.min(LOOK.yawMax, t.yaw + 0.25);
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          t.yaw = Math.max(-LOOK.yawMax, t.yaw - 0.25);
          break;
        case 'Escape':
          if (closetStore.getState().selectedSiteId) {
            sound.putBack();
            closetStore.deselectSite();
          }
          break;
        default:
          return;
      }
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const cam = state.camera as THREE.PerspectiveCamera;
    const t = target.current;
    cam.rotation.order = 'YXZ';
    // Subtle parallax from the pointer so the room breathes even when idle.
    const parallaxYaw = -state.pointer.x * 0.035;
    const parallaxPitch = state.pointer.y * 0.025;
    easing.damp(cam.rotation, 'y', t.yaw + parallaxYaw, 0.25, dt);
    easing.damp(cam.rotation, 'x', t.pitch + parallaxPitch, 0.25, dt);
    easing.damp(cam.position, 'y', t.y, 0.3, dt);
    // Portrait screens see too little shelf at the desktop fov; widen it.
    const portraitBoost = cam.aspect < 0.8 ? 16 : 0;
    easing.damp(cam, 'fov', t.fov + portraitBoost, 0.2, dt);
    cam.updateProjectionMatrix();
  });

  return null;
}

/** Flashlight cone that follows the pointer ray. */
function Flashlight() {
  const light = useRef<THREE.SpotLight>(null);
  const aim = useMemo(() => new THREE.Object3D(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const spot = light.current;
    if (!spot) return;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    goal.copy(state.raycaster.ray.origin).addScaledVector(state.raycaster.ray.direction, 1.8);
    easing.damp3(aim.position, goal, 0.1, delta);
    aim.updateMatrixWorld();
    easing.damp3(spot.position, [state.camera.position.x, state.camera.position.y + 0.08, state.camera.position.z + 0.05], 0.1, delta);
    // A held case sits right under the beam; soften it so the cover is readable.
    easing.damp(spot, 'intensity', closetStore.getState().selectedSiteId ? 0.6 : 7, 0.3, delta);
  });

  return (
    <>
      <primitive object={aim} />
      <spotLight
        ref={light}
        target={aim}
        angle={0.36}
        penumbra={0.85}
        intensity={7}
        color="#fff1d6"
        distance={5}
        decay={2}
      />
    </>
  );
}

function SceneLights() {
  return (
    <>
      <hemisphereLight args={['#ffe2b8', '#2a1a12', 0.9]} />
      <pointLight position={[0, 1.2, -0.35]} color="#ffd6a0" intensity={2.6} distance={5} decay={2} />
      <pointLight position={[0, 1.2, 0.55]} color="#ffd6a0" intensity={1.6} distance={5} decay={2} />
    </>
  );
}

interface ClosetSceneProps {
  sites: Site[];
  /** Index in `sites` where this visit's live resurrections begin. */
  resurrectedFrom: number;
}

export default function ClosetScene({ sites, resurrectedFrom }: ClosetSceneProps) {
  const selectedSiteId = useClosetStore((s) => s.selectedSiteId);

  return (
    <div className="absolute inset-0 select-none touch-none">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.18, 0.8], fov: FOV.initial, near: 0.05, far: 12 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMappingExposure = 1.15;
          scene.background = new THREE.Color('#0c0b0e');
        }}
        onPointerMissed={(e) => {
          if (selectedSiteId && e.type === 'click' && interaction.dragDistance < 6) {
            sound.putBack();
            closetStore.deselectSite();
          }
        }}
      >
        <fogExp2 attach="fog" args={['#0c0b0e', 0.16]} />
        <CameraRig />
        <SceneLights />
        <Flashlight />
        <ClosetRoom sites={sites} resurrectedFrom={resurrectedFrom} />
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.3} intensity={0.9} mipmapBlur />
          <Vignette darkness={0.7} offset={0.28} />
          <Noise opacity={0.035} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
