"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { Icon } from "@/components/ui/icon";
import { chairs, footprint } from "@/lib/tables/geometry";
import type { Area, CafeTable } from "@/lib/tables/schema";

/*
 * 3D view of one area (three.js via React Three Fiber). Same layout data and geometry as the 2D
 * editor (metres; 2D x → 3D x, 2D y → 3D z; 2D clockwise rotation → negative Y rotation).
 * Loaded on demand (next/dynamic, no SSR) and rendered only when something changes.
 */

export type Floor3DProps = {
  area: Area;
  tables: CafeTable[];
  selectedId: string | null;
  onSelect: (t: CafeTable | null) => void;
  /** Café brand colours (hex) for the selected table and the floor tint. */
  colors: { primary: string; container: string };
};

/** Furniture materials (neutral café palette). */
const MAT = {
  floor: "#f8efeb",
  wall: "#d4c3ba",
  top: "#a1887f",
  topOff: "#cfc6c2",
  leg: "#4e342e",
  chair: "#6d5b4f",
  chairOff: "#bcb3ae",
} as const;

const TABLE_H = { normal: 0.75, bar: 1.05 } as const;

/**
 * Table name drawn into a texture on a sprite (always faces the camera). No DOM overlay and no
 * font download: the browser's own font renders the text once into a small canvas.
 */
function Label({
  text,
  y,
  active,
  primary,
}: {
  text: string;
  y: number;
  active: boolean;
  primary: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = "700 44px 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 48;
    canvas.width = w;
    canvas.height = 72;
    ctx.font = font;
    ctx.fillStyle = active ? primary : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, 68, 34);
    ctx.fill();
    ctx.fillStyle = active ? "#ffffff" : "#1e1b19";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, 38);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return { t, aspect: w / 72 };
  }, [text, active, primary]);
  useEffect(() => () => texture.t.dispose(), [texture]);
  const h = 0.34;
  return (
    <sprite position={[0, y, 0]} scale={[h * texture.aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={texture.t} depthTest={false} transparent />
    </sprite>
  );
}

function Table3D({
  t,
  area,
  selected,
  primary,
  onSelect,
}: {
  t: CafeTable;
  area: Area;
  selected: boolean;
  primary: string;
  onSelect: (t: CafeTable) => void;
}) {
  const [hover, setHover] = useState(false);
  const f = footprint(t.shape, t.seats);
  const bar = t.shape === "bar";
  const h = bar ? TABLE_H.bar : TABLE_H.normal;
  const top = selected || hover ? primary : t.isActive ? MAT.top : MAT.topOff;
  const chairColor = t.isActive ? MAT.chair : MAT.chairOff;

  return (
    <group
      position={[t.x - area.widthM / 2, 0, t.y - area.depthM / 2]}
      rotation={[0, (-t.rotation * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(t);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      {/* Top */}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        {f.round ? (
          <cylinderGeometry args={[f.w / 2, f.w / 2, 0.04, 40]} />
        ) : (
          <boxGeometry args={[f.w, 0.04, f.d]} />
        )}
        <meshStandardMaterial color={top} roughness={0.6} />
      </mesh>
      {/* Leg / pedestal */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, h, 12]} />
        <meshStandardMaterial color={MAT.leg} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[Math.min(f.w, f.d) * 0.3, Math.min(f.w, f.d) * 0.3, 0.02, 24]} />
        <meshStandardMaterial color={MAT.leg} />
      </mesh>
      {/* Chairs (stools at bar tables) */}
      {chairs(t.shape, t.seats).map((c, i) => (
        <group key={i} position={[c.x, 0, c.y]} rotation={[0, (-c.angle * Math.PI) / 180, 0]}>
          {bar ? (
            <>
              <mesh position={[0, 0.75, 0]} castShadow>
                <cylinderGeometry args={[0.17, 0.17, 0.05, 20]} />
                <meshStandardMaterial color={chairColor} />
              </mesh>
              <mesh position={[0, 0.375, 0]}>
                <cylinderGeometry args={[0.025, 0.03, 0.75, 8]} />
                <meshStandardMaterial color={MAT.leg} />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[0.4, 0.05, 0.38]} />
                <meshStandardMaterial color={chairColor} />
              </mesh>
              {/* back rest on the side away from the table */}
              <mesh position={[0, 0.7, -0.17]} castShadow>
                <boxGeometry args={[0.4, 0.45, 0.04]} />
                <meshStandardMaterial color={chairColor} />
              </mesh>
              <mesh position={[0, 0.225, 0]}>
                <boxGeometry args={[0.04, 0.45, 0.04]} />
                <meshStandardMaterial color={MAT.leg} />
              </mesh>
            </>
          )}
        </group>
      ))}
      <Label text={t.label} y={h + 0.4} active={selected} primary={primary} />
    </group>
  );
}

export default function Floor3D({ area, tables, selectedId, onSelect, colors }: Floor3DProps) {
  const size = Math.max(area.widthM, area.depthM);
  const wallH = 0.25;
  const walls: [number, number, number, number, number][] = [
    // [x, z, width, depth] per wall (low walls just to frame the room)
    [0, -area.depthM / 2, area.widthM, 0.1, 0],
    [0, area.depthM / 2, area.widthM, 0.1, 0],
    [-area.widthM / 2, 0, 0.1, area.depthM, 0],
    [area.widthM / 2, 0, 0.1, area.depthM, 0],
  ];
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [size * 0.35, size * 0.55, size * 0.7], fov: 45, near: 0.1, far: 200 }}
      onPointerMissed={() => onSelect(null)}
      fallback={
        <div className="flex h-full items-center justify-center gap-xs p-lg text-center text-body-sm text-on-surface-variant">
          <Icon name="view_in_ar" className="text-icon-lg" /> 3D is not available in this browser.
        </div>
      }
      aria-label={`3D view of ${area.name}`}
    >
      <color attach="background" args={["#fbf2ee"]} />
      <hemisphereLight args={["#ffffff", "#e9e1dd", 1.6]} />
      <directionalLight
        position={[size * 0.4, size, size * 0.6]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
      />
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[area.widthM, area.depthM]} />
        <meshStandardMaterial color={MAT.floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[area.widthM + 1.2, area.depthM + 1.2]} />
        <meshStandardMaterial color={colors.container} />
      </mesh>
      {walls.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, wallH / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[w, wallH, d]} />
          <meshStandardMaterial color={MAT.wall} />
        </mesh>
      ))}
      {tables.map((t) => (
        <Table3D
          key={t.id}
          t={t}
          area={area}
          selected={t.id === selectedId}
          primary={colors.primary}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        makeDefault
        enableDamping
        target={[0, 0.4, 0]}
        minDistance={2}
        maxDistance={size * 2.5}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}
