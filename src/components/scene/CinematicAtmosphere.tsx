'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import {
  ATMOSPHERE_QUALITY_PRESETS,
  DEFAULT_DUST_BOUNDS,
  DEFAULT_GLOW_POSITION,
  GLOW_BREATH_CONFIG,
  advanceDustField,
  computeBreathIntensity,
  createDustField,
  getAtmosphereStateForProgress,
  type AtmosphereQuality,
  type DustField,
  type StationAtmosphereState,
} from './StationEffects';

/**
 * CinematicAtmosphere
 * ---------------------
 * Visual atmosphere layer for the subway station: a slow-drifting dust
 * field plus one restrained, "breathing" accent light. Nothing here is
 * the station model, the shoe, the main camera, ScrollTrigger, or the
 * station journey timeline — those all keep their existing owners
 * (`SubwayStation`, `AdidasShoe`, `CameraRig`/`Experience`,
 * `ScrollController`, `StationJourney`/`StationAnimation`).
 *
 * ---- Deliberately does NOT touch fog or the base lighting rig ----
 * `SceneEnvironment.tsx` already attaches the scene's `<fog>` and owns a
 * full base rig (hemisphere fill + one shadow-casting directional key +
 * two point accents). Re-declaring any of that here would silently
 * override or fight it — Three.js only keeps one `scene.fog`, and a
 * second fill/key light would just be uncontrolled extra cost for a
 * scene the brief asks to keep cheap. So:
 *   - No `<fog>` is added here. The dust particles still fade into the
 *     distance for free, because `THREE.PointsMaterial.fog` is `true` by
 *     default (kept explicit below) — any material with `fog` enabled is
 *     automatically affected by whatever `scene.fog` `SceneEnvironment`
 *     has attached, no coordination needed between the two files.
 *   - No hemisphere/directional/fill light is added here. The ONE light
 *     this file contributes is a single non-shadow-casting point light —
 *     a soft "vanishing point" glow positioned deeper in the station
 *     (derived from `StationAnimation`'s own `STATION_END_STATE`, via
 *     `StationEffects`) that breathes very slightly, which is
 *     specifically an atmosphere/mood concern (env motion, depth
 *     cueing), not base scene lighting. Total added light count: 1.
 *
 * ---- Scroll wiring: modular, not connected yet ----
 * This component owns no ScrollTrigger and reads no scroll state
 * directly. Instead it exposes `setProgress()` on its imperative handle,
 * written straight into a ref and read back inside this component's own
 * `useFrame` — the same "never React state for a per-frame value"
 * pattern `ScrollController`/`StationJourney` already use for the camera
 * timeline. A future integration (most naturally inside `StationJourney`,
 * alongside its existing `externalScroll` poll) can call
 * `atmosphereRef.current.setProgress(progress)` from the same `useFrame`
 * tick that already drives the camera timeline — see this file's
 * response write-up for the exact call site. Left unconnected, this
 * component still renders and animates correctly using progress `0`'s
 * (brightest/cleanest) atmosphere state.
 *
 * Mount this inside the `<Canvas>`, as a sibling of `<SceneEnvironment />`
 * and the station's group — see the response write-up for the precise
 * placement relative to `Experience.tsx` / `StationJourney.tsx`.
 */

export interface CinematicAtmosphereHandle {
  /**
   * Feed the station journey's 0–1 progress in from an existing
   * `useFrame` loop. Writes straight into a ref — never triggers a React
   * re-render, so it can be called every frame without fighting the
   * render loop that already owns the camera timeline.
   */
  setProgress: (progress: number) => void;
}

export interface CinematicAtmosphereProps {
  /**
   * Governs particle count and whether the accent glow / its breathing
   * animation run at all. No device detection happens here — pass this
   * through from whatever capability check a future generation adds.
   * Default: 'high'.
   */
  quality?: AtmosphereQuality;
  /** Dust particle color. Default: a desaturated cool-neutral off-white, matched to the existing rig's restrained palette rather than a saturated accent. */
  dustColor?: string;
  /** Dust particle size, world units, with size attenuation. Default: 0.035 — small enough to read as motes, not confetti. */
  dustSize?: number;
  /** Multiplier on top of the progress-driven particle opacity. Default: 1. */
  dustOpacity?: number;
  /** Bounding volume the dust field is generated and wrapped within. Default: `DEFAULT_DUST_BOUNDS` (derived from the journey's own start/end Z — see `StationEffects.ts`). */
  dustBounds?: typeof DEFAULT_DUST_BOUNDS;
  /** Accent glow light color. Default: a restrained cool blue-gray, consistent with `SceneEnvironment`'s existing cool accent rather than introducing a new hue. */
  glowColor?: string;
  /** Accent glow light position. Default: `DEFAULT_GLOW_POSITION`, derived from `StationAnimation`'s `STATION_END_STATE`. */
  glowPosition?: readonly [number, number, number];
  /** Master toggle for the dust field, independent of `quality`. Default: true. */
  enableParticles?: boolean;
  /** Master toggle for the accent glow light, independent of `quality`. Default: true. */
  enableAccentGlow?: boolean;
}

const DEFAULT_DUST_COLOR = '#cdd3da';
const DEFAULT_GLOW_COLOR = '#7f97b8';
const DEFAULT_DUST_SIZE = 0.035;
const GLOW_DISTANCE = 16;
const GLOW_DECAY = 2;

export const CinematicAtmosphere = forwardRef<CinematicAtmosphereHandle, CinematicAtmosphereProps>(
  function CinematicAtmosphere(
    {
      quality = 'high',
      dustColor = DEFAULT_DUST_COLOR,
      dustSize = DEFAULT_DUST_SIZE,
      dustOpacity = 1,
      dustBounds = DEFAULT_DUST_BOUNDS,
      glowColor = DEFAULT_GLOW_COLOR,
      glowPosition = DEFAULT_GLOW_POSITION,
      enableParticles = true,
      enableAccentGlow = true,
    },
    ref
  ) {
    const preset = ATMOSPHERE_QUALITY_PRESETS[quality];
    const particlesEnabled = enableParticles && preset.particleCount > 0;
    const glowEnabled = enableAccentGlow && preset.enableAccentGlow;

    // Allocated once per (enabled state / quality / bounds) change — never
    // inside useFrame. `advanceDustField` mutates `dustField.positions` in
    // place every frame instead of this being recreated.
    const dustField = useMemo<DustField | null>(
      () => (particlesEnabled ? createDustField(preset.particleCount, dustBounds) : null),
      [particlesEnabled, preset.particleCount, dustBounds]
    );

    // Built imperatively (new THREE.BufferGeometry + setAttribute) rather
    // than as nested `<bufferGeometry>`/`<bufferAttribute>` JSX. Same
    // motivation `SubwayStation.tsx` already notes elsewhere in this
    // codebase: those elements' required-prop typing has shifted between
    // fiber v8 and v9, while assigning a plain `THREE.BufferGeometry`
    // instance to `<points geometry={...}>` is stable across both.
    const dustGeometry = useMemo(() => {
      if (!dustField) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(dustField.positions, 3));
      return geometry;
    }, [dustField]);

    useEffect(() => {
      return () => {
        dustGeometry?.dispose();
      };
    }, [dustGeometry]);

    const pointsMaterialRef = useRef<THREE.PointsMaterial>(null);
    const glowLightRef = useRef<THREE.PointLight>(null);

    // Target atmosphere state, written imperatively via setProgress — see
    // this file's header for why this is a ref and not React state.
    const atmosphereStateRef = useRef<StationAtmosphereState>(getAtmosphereStateForProgress(0));

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (progress: number) => {
          atmosphereStateRef.current = getAtmosphereStateForProgress(progress);
        },
      }),
      []
    );

    useFrame((state) => {
      const elapsed = state.clock.elapsedTime;
      const atmosphere = atmosphereStateRef.current;

      if (dustField && dustGeometry) {
        advanceDustField(dustField, elapsed, dustBounds);
        const attr = dustGeometry.attributes.position as THREE.BufferAttribute;
        attr.needsUpdate = true;
      }

      if (pointsMaterialRef.current) {
        pointsMaterialRef.current.opacity = atmosphere.particleOpacity * dustOpacity;
      }

      if (glowEnabled && glowLightRef.current) {
        const breath = preset.enableBreathing
          ? computeBreathIntensity(elapsed, GLOW_BREATH_CONFIG)
          : GLOW_BREATH_CONFIG.base;
        glowLightRef.current.intensity = breath * atmosphere.accentGlowIntensity;
      }
    });

    return (
      <>
        {particlesEnabled && dustField && dustGeometry && (
          <points geometry={dustGeometry} frustumCulled={false}>
            {/*
              `fog` kept explicit (it already defaults to true) so the
              dependency on SceneEnvironment's scene fog is visible in
              code, not just in this file's header comment. No
              AdditiveBlending — normal blending at low opacity keeps
              this read as quiet suspended dust rather than a glow/sparkle
              effect.
            */}
            <pointsMaterial
              ref={pointsMaterialRef}
              color={dustColor}
              size={dustSize}
              sizeAttenuation
              transparent
              opacity={atmosphereStateRef.current.particleOpacity * dustOpacity}
              depthWrite={false}
              fog
            />
          </points>
        )}

        {glowEnabled && (
          <pointLight
            ref={glowLightRef}
            color={glowColor}
            position={glowPosition as [number, number, number]}
            intensity={GLOW_BREATH_CONFIG.base}
            distance={GLOW_DISTANCE}
            decay={GLOW_DECAY}
          />
        )}
      </>
    );
  }
);
