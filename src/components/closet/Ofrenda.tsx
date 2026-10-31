'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { ROOM, SHELF } from './closetLayout';
import { hashString } from './TextureFactory';

const waxMaterial = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.85 });
const flameMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.9, 0.5), toneMapped: false });
const candleGeometry = new THREE.CylinderGeometry(1, 1, 1, 20);
const flameGeometry = new THREE.SphereGeometry(1, 12, 10);
const petalGeometry = new THREE.IcosahedronGeometry(1, 0);
const petalMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
const stringMaterial = new THREE.MeshBasicMaterial({ color: '#3b3330' });

const TOP = SHELF.topY + SHELF.thickness / 2;
const BACK_Z = ROOM.backZ + SHELF.depth / 2 - 0.02;
const SIDE_X = ROOM.halfWidth - SHELF.depth / 2 + 0.02;

interface CandleSpec {
  position: [number, number, number];
  radius: number;
  height: number;
}

const CANDLES: CandleSpec[] = [
  { position: [-0.86, TOP, BACK_Z], radius: 0.026, height: 0.15 },
  { position: [-0.78, TOP, BACK_Z + 0.05], radius: 0.018, height: 0.08 },
  { position: [-0.42, TOP, BACK_Z], radius: 0.022, height: 0.11 },
  { position: [-0.08, TOP, BACK_Z - 0.02], radius: 0.03, height: 0.19 },
  { position: [0.02, TOP, BACK_Z + 0.05], radius: 0.02, height: 0.09 },
  { position: [0.38, TOP, BACK_Z], radius: 0.024, height: 0.13 },
  { position: [0.8, TOP, BACK_Z + 0.03], radius: 0.02, height: 0.1 },
  { position: [0.88, TOP, BACK_Z - 0.03], radius: 0.026, height: 0.16 },
  { position: [-SIDE_X, TOP, -0.6], radius: 0.024, height: 0.12 },
  { position: [-SIDE_X, TOP, -0.1], radius: 0.02, height: 0.09 },
  { position: [SIDE_X, TOP, -0.55], radius: 0.026, height: 0.14 },
  { position: [SIDE_X, TOP, 0.0], radius: 0.02, height: 0.08 },
];

/** Warm flickering lights shared by groups of candles (fewer lights, same look). */
const CANDLE_LIGHTS: [number, number, number][] = [
  [-0.62, TOP + 0.22, BACK_Z + 0.12],
  [0.18, TOP + 0.24, BACK_Z + 0.12],
  [0.84, TOP + 0.22, BACK_Z + 0.12],
  [-SIDE_X + 0.1, TOP + 0.2, -0.35],
  [SIDE_X - 0.1, TOP + 0.2, -0.3],
];

const MARIGOLD_TONES = ['#ff9e00', '#ffb000', '#ff8a00', '#ffc23d', '#f27a00'];

function Flames() {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const targets = useRef(CANDLE_LIGHTS.map(() => ({ intensity: 0.9, next: 0 })));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    targets.current.forEach((target, i) => {
      if (t > target.next) {
        target.intensity = 0.55 + Math.random() * 0.7;
        target.next = t + 0.05 + Math.random() * 0.18;
      }
      const light = lights.current[i];
      if (light) easing.damp(light, 'intensity', target.intensity, 0.07, delta);
    });
    flames.current.forEach((flame, i) => {
      if (!flame) return;
      const spec = CANDLES[i];
      const flick = 1 + 0.18 * Math.sin(t * 13 + i * 1.7) * Math.sin(t * 7.3 + i);
      easing.damp(flame.scale, 'y', spec.radius * 0.9 * flick, 0.05, delta);
    });
  });

  return (
    <group>
      {CANDLE_LIGHTS.map((p, i) => (
        <pointLight
          key={`light-${i}`}
          ref={(el) => {
            lights.current[i] = el;
          }}
          position={p}
          color="#ff9a3c"
          intensity={0.9}
          distance={1.8}
          decay={2}
        />
      ))}
      {CANDLES.map((c, i) => (
        <group key={`candle-${i}`} position={c.position}>
          <mesh
            geometry={candleGeometry}
            material={waxMaterial}
            position={[0, c.height / 2, 0]}
            scale={[c.radius, c.height, c.radius]}
          />
          <mesh
            ref={(el) => {
              flames.current[i] = el;
            }}
            geometry={flameGeometry}
            material={flameMaterial}
            position={[0, c.height + c.radius * 0.7, 0]}
            scale={[c.radius * 0.32, c.radius * 0.9, c.radius * 0.32]}
          />
        </group>
      ))}
    </group>
  );
}

/** Cempasúchil (marigold) clusters heaped between the candles. */
function Marigolds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const petals = useMemo(() => {
    const clusters: [number, number][] = [
      [-0.64, BACK_Z], [-0.25, BACK_Z + 0.02], [0.2, BACK_Z], [0.6, BACK_Z + 0.02],
    ];
    const out: { p: [number, number, number]; s: number; c: string }[] = [];
    clusters.forEach(([cx, cz], ci) => {
      for (let k = 0; k < 90; k++) {
        const h = hashString(`m${ci}-${k}`);
        const a = ((h % 360) * Math.PI) / 180;
        const r = Math.sqrt(((h >> 9) % 100) / 100);
        const mound = Math.cos(r * (Math.PI / 2));
        out.push({
          p: [cx + Math.cos(a) * r * 0.075, TOP + 0.01 + mound * 0.055, cz + Math.sin(a) * r * 0.05],
          s: 0.013 + ((h >> 3) % 7) * 0.0016,
          c: MARIGOLD_TONES[h % MARIGOLD_TONES.length],
        });
      }
    });
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    petals.forEach((petal, i) => {
      dummy.position.set(...petal.p);
      dummy.rotation.set(i * 0.7, i * 1.3, 0);
      dummy.scale.setScalar(petal.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(petal.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [petals]);

  return <instancedMesh ref={ref} args={[petalGeometry, petalMaterial, petals.length]} />;
}

const PICADO_COLORS = ['#ff4f9a', '#ff9e00', '#8e5cff', '#2ecc8f', '#19b8d8', '#ffd23f'];

function makePicadoTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 300;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    // Scalloped bottom edge
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath();
      ctx.arc(x + 16, h, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    // Border holes
    for (let x = 22; x < w - 10; x += 24) {
      ctx.beginPath();
      ctx.arc(x, 30, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, h - 40, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Central calavera: eyes, nose, teeth, and a flower crown
    const cx = w / 2;
    const cy = 150;
    ctx.beginPath();
    ctx.ellipse(cx - 34, cy - 8, 22, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 34, cy - 8, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 22);
    ctx.lineTo(cx - 10, cy + 40);
    ctx.lineTo(cx + 10, cy + 40);
    ctx.closePath();
    ctx.fill();
    for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * 13 - 4, cy + 56, 8, 18);
    for (let i = 0; i < 5; i++) {
      const fx = cx - 60 + i * 30;
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 8, 76 + Math.sin(a) * 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Swirls in the corners
    ctx.lineWidth = 6;
    [[40, 110], [w - 40, 110], [40, 210], [w - 40, 210]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 1.5);
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Papel picado banner strung along the back wall above the ofrenda. */
function PapelPicado() {
  const flags = useRef<(THREE.Mesh | null)[]>([]);
  const { materials, geometry, count, span, y, z } = useMemo(() => {
    const texture = makePicadoTexture();
    return {
      materials: PICADO_COLORS.map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            map: texture,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            roughness: 0.9,
            emissive: c,
            emissiveIntensity: 0.05,
          })
      ),
      geometry: new THREE.PlaneGeometry(0.13, 0.15).translate(0, -0.075, 0),
      count: 15,
      span: ROOM.halfWidth * 2 - 0.2,
      y: 1.08,
      z: ROOM.backZ + 0.08,
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    flags.current.forEach((flag, i) => {
      if (flag) flag.rotation.x = Math.sin(t * 1.4 + i * 0.9) * 0.14 + Math.sin(t * 0.37 + i) * 0.05;
    });
  });

  return (
    <group position={[0, y, z]}>
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[span, 0.003, 0.003]} />
        <primitive object={stringMaterial} attach="material" />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const x = -span / 2 + 0.07 + (i * (span - 0.14)) / (count - 1);
        const sag = -0.03 * (1 - Math.pow((2 * x) / span, 2));
        return (
          <mesh
            key={i}
            ref={(el) => {
              flags.current[i] = el;
            }}
            position={[x, sag, 0]}
            geometry={geometry}
            material={materials[i % materials.length]}
          />
        );
      })}
    </group>
  );
}

export function Ofrenda() {
  return (
    <group>
      <Flames />
      <Marigolds />
      <PapelPicado />
    </group>
  );
}
