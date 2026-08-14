'use client';

import { Suspense } from 'react';
import { Environment } from '@react-three/drei';

/**
 * Environment-only scene setup: background, fog, and the layered lighting
 * rig. No models, no camera, no Canvas, no scroll/animation logic live
 * here — see Experience.tsx for those.
 *
 * Visual direction (per brief): premium, cinematic, dark, modern,
 * architectural, high contrast, sophisticated. Deliberately avoided:
 * saturated neon/RGB accents, heavy bloom, thick fog.
 *
 * All tuning values are named constants below so a later developer can
 * recalibrate lighting once the real station/shoe GLBs (with real-world
 * scale) exist, without hunting through JSX.
 */

/** Near-black, slightly cool — reads as an unlit platform, not pure void. */
const BACKGROUND_COLOR = '#07090c';

/** Fog matches the background so depth fades to it, not a visible fog color. */
const FOG_COLOR = BACKGROUND_COLOR;
/**
 * Deliberately generous near/far distances. These are placeholders: the
 * station's real-world scale is unknown until the real GLB exists (see
 * Experience.tsx header comment), so these only need to feel restrained
 * relative to a "typical" architectural interior for now. Retune once real
 * geometry is in the scene — the goal is midground/background falloff
 * without ever obscuring the station itself.
 */
const FOG_NEAR = 10;
const FOG_FAR = 45;

/** Soft, shadow-free fill so unlit surfaces don't crush to pure black. */
const FILL_LIGHT = {
  skyColor: '#3a4a5e',
  groundColor: '#0a0a0c',
  intensity: 0.35,
} as const;

/**
 * The single shadow-casting light in the rig. One directional key light
 * keeps the "layered lighting, not one giant light" requirement without
 * paying for more than one shadow map.
 */
const KEY_LIGHT = {
  color: '#e8ecf2',
  intensity: 1.4,
  position: [6, 9, 4] as [number, number, number],
} as const;

/**
 * Two restrained, non-shadow-casting accent lights for cinematic depth —
 * an amber "platform lamp" and a cool architectural rim. Intentionally
 * low-saturation: this is the line between "cinematic accent" and
 * "gaming RGB" the brief calls out.
 */
const ACCENT_WARM = {
  color: '#ffb877',
  intensity: 6,
  position: [-4, 2.2, -3] as [number, number, number],
  distance: 12,
  decay: 2,
} as const;

const ACCENT_COOL = {
  color: '#4d6fa0',
  intensity: 4,
  position: [3, 1.5, -6] as [number, number, number],
  distance: 14,
  decay: 2,
} as const;

export function SceneEnvironment() {
  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      <hemisphereLight
        color={FILL_LIGHT.skyColor}
        groundColor={FILL_LIGHT.groundColor}
        intensity={FILL_LIGHT.intensity}
      />

      <directionalLight
        color={KEY_LIGHT.color}
        intensity={KEY_LIGHT.intensity}
        position={KEY_LIGHT.position}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />

      <pointLight
        color={ACCENT_WARM.color}
        intensity={ACCENT_WARM.intensity}
        position={ACCENT_WARM.position}
        distance={ACCENT_WARM.distance}
        decay={ACCENT_WARM.decay}
      />
      <pointLight
        color={ACCENT_COOL.color}
        intensity={ACCENT_COOL.intensity}
        position={ACCENT_COOL.position}
        distance={ACCENT_COOL.distance}
        decay={ACCENT_COOL.decay}
      />

      {/*
        Cheap image-based lighting for believable reflections on the shoe's
        leather/plastic/logo materials (23 materials per AdidasShoe.tsx) —
        one baked texture, no extra real-time light cost. `background=false`
        keeps the dark color/fog above in charge of what's actually visible;
        this only feeds the reflection/IBL term.

        This fetches a stock HDRI from drei's CDN at runtime. That's a
        reasonable default for now, but flagging it explicitly: if the
        project wants everything self-hosted, swap `preset` for a local
        `files="/hdri/your-file.hdr"` pointing at an asset under public/.
        Wrapped in its own Suspense so the rest of the lighting rig renders
        immediately instead of waiting on this fetch.
      */}
      <Suspense fallback={null}>
        <Environment preset="warehouse" background={false} />
      </Suspense>
    </>
  );
}
