import * as THREE from 'three';

export type AtmosphereQuality = 'high' | 'medium' | 'low';

export interface DustBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface DustField {
  positions: Float32Array;
  velocities: Float32Array;
  phases: Float32Array;
}

export interface StationAtmosphereState {
  particleOpacity: number;
  accentGlowIntensity: number;
}

export interface GlowBreathConfig {
  base: number;
  amplitude: number;
  speed: number;
  phase: number;
}

/**
 * Particle counts are deliberately conservative.
 * The station model itself is already the expensive asset.
 */
export const ATMOSPHERE_QUALITY_PRESETS: Record<
  AtmosphereQuality,
  {
    particleCount: number;
    enableAccentGlow: boolean;
    enableBreathing: boolean;
  }
> = {
  high: {
    particleCount: 900,
    enableAccentGlow: true,
    enableBreathing: true,
  },
  medium: {
    particleCount: 500,
    enableAccentGlow: true,
    enableBreathing: true,
  },
  low: {
    particleCount: 220,
    enableAccentGlow: false,
    enableBreathing: false,
  },
};

/**
 * Broad station volume for suspended dust.
 * The field is wrapped around this volume continuously.
 */
export const DEFAULT_DUST_BOUNDS: DustBounds = {
  minX: -8,
  maxX: 8,
  minY: 0.15,
  maxY: 4.5,
  minZ: -18,
  maxZ: 8,
};

/**
 * Deeper in the station, used as the restrained atmospheric accent.
 */
export const DEFAULT_GLOW_POSITION: readonly [number, number, number] = [
  0,
  2.2,
  -10,
];

/**
 * Small breathing motion rather than an obvious pulsing light.
 */
export const GLOW_BREATH_CONFIG: GlowBreathConfig = {
  base: 0.7,
  amplitude: 0.16,
  speed: 0.45,
  phase: 0,
};

/**
 * Creates the initial particle positions and tiny per-particle motion data.
 */
export function createDustField(
  count: number,
  bounds: DustBounds = DEFAULT_DUST_BOUNDS
): DustField {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    positions[i3] =
      bounds.minX + Math.random() * (bounds.maxX - bounds.minX);

    positions[i3 + 1] =
      bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

    positions[i3 + 2] =
      bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

    velocities[i3] = (Math.random() - 0.5) * 0.018;
    velocities[i3 + 1] = 0.004 + Math.random() * 0.012;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.012;

    phases[i] = Math.random() * Math.PI * 2;
  }

  return {
    positions,
    velocities,
    phases,
  };
}

/**
 * Advances the dust field without allocating new arrays.
 *
 * This is intentionally mutation-based because it runs every frame.
 */
export function advanceDustField(
  dustField: DustField,
  elapsed: number,
  bounds: DustBounds = DEFAULT_DUST_BOUNDS
): void {
  const { positions, velocities, phases } = dustField;

  for (let i = 0; i < phases.length; i++) {
    const i3 = i * 3;
    const phase = phases[i];

    positions[i3] +=
      velocities[i3] +
      Math.sin(elapsed * 0.22 + phase) * 0.0008;

    positions[i3 + 1] +=
      velocities[i3 + 1] +
      Math.sin(elapsed * 0.35 + phase * 1.7) * 0.0005;

    positions[i3 + 2] +=
      velocities[i3 + 2] +
      Math.cos(elapsed * 0.18 + phase) * 0.0006;

    if (positions[i3] > bounds.maxX) {
      positions[i3] = bounds.minX;
    } else if (positions[i3] < bounds.minX) {
      positions[i3] = bounds.maxX;
    }

    if (positions[i3 + 1] > bounds.maxY) {
      positions[i3 + 1] = bounds.minY;
    } else if (positions[i3 + 1] < bounds.minY) {
      positions[i3 + 1] = bounds.maxY;
    }

    if (positions[i3 + 2] > bounds.maxZ) {
      positions[i3 + 2] = bounds.minZ;
    } else if (positions[i3 + 2] < bounds.minZ) {
      positions[i3 + 2] = bounds.maxZ;
    }
  }
}

/**
 * Converts the master story progress into atmosphere values.
 *
 * The station starts relatively clean and gradually becomes more
 * atmospheric as the camera travels deeper into the environment.
 */
export function getAtmosphereStateForProgress(
  progress: number
): StationAtmosphereState {
  const p = THREE.MathUtils.clamp(progress, 0, 1);

  const particleOpacity = THREE.MathUtils.lerp(
    0.16,
    0.72,
    THREE.MathUtils.smoothstep(p, 0, 1)
  );

  const accentGlowIntensity = THREE.MathUtils.lerp(
    0.45,
    1.0,
    THREE.MathUtils.smoothstep(p, 0.15, 0.9)
  );

  return {
    particleOpacity,
    accentGlowIntensity,
  };
}

/**
 * Returns the current intensity of the breathing accent light.
 */
export function computeBreathIntensity(
  elapsed: number,
  config: GlowBreathConfig = GLOW_BREATH_CONFIG
): number {
  const wave =
    Math.sin(elapsed * config.speed + config.phase) * config.amplitude;

  return Math.max(0, config.base + wave);
}