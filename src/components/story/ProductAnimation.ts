import gsap from 'gsap';
import * as THREE from 'three';

/**
 * ProductAnimation
 * -----------------
 * Pure animation logic (no React, no JSX, no scene-object instantiation)
 * for the Adidas product showcase — same split StationAnimation.ts /
 * TransitionAnimation.ts already establish for their own scenes:
 *
 *   ProductShowcase.tsx  (React/R3F component, owns refs + GSAP context)
 *            ↓ calls into
 *   ProductAnimation.ts  (this file — deterministic GSAP timeline + math)
 *
 * ---------------------------------------------------------------------
 * ARCHITECTURE THIS WAS BUILT AGAINST:
 * ---------------------------------------------------------------------
 * - `Experience.tsx` owns a single bare `PerspectiveCamera` (`cameraRef`)
 *   and a `shoeGroup` wrapping the already-mounted `<AdidasShoe>`. That
 *   `shoeGroup` is the exact object `WorldTransition.tsx` also animates
 *   ("shoe emerges" is the last beat of its own timeline). This file
 *   never mounts a new camera, group, or model — it only tweens the
 *   camera/shoeGroup objects it's handed.
 * - `CameraRig`/`StationJourney`'s parallel rig/head tree is NOT the live
 *   camera (per `WorldTransition.tsx`'s own header finding), so this file
 *   targets `camera` directly rather than a rig/head split.
 * - This file intentionally does NOT import, read, or modify
 *   `TransitionAnimation.ts`, per this generation's brief. Its real
 *   station→product hand-off values are therefore unknown here.
 *
 * ---------------------------------------------------------------------
 * WHY `PRODUCT_STAGE_START` / `PRODUCT_CAMERA_START` ARE SAFE GUESSES:
 * ---------------------------------------------------------------------
 * Every tween below is built with `.to()`, never `.fromTo()` — GSAP
 * captures "from" as whatever the object's LIVE value is when that
 * segment first renders. So if `TransitionAnimation.ts`'s real hand-off
 * pose differs from the placeholders below, `ProductShowcase` still
 * continues smoothly from wherever the shoe/camera actually are; the
 * placeholders only matter for documentation and for the optional
 * `snapToStart: true` isolated-testing path (mirrors `WorldTransition`'s
 * own `snapToStationEnd`). Recalibrate `SHOE_WAYPOINTS[0]` /
 * `CAMERA_WAYPOINTS[0]` once `TransitionAnimation.ts`'s real end state is
 * known/exported (e.g. a future `TRANSITION_END_STATE`, the same pattern
 * `StationAnimation.ts` uses for `STATION_END_STATE`).
 *
 * ---------------------------------------------------------------------
 * WHY THE SHOE'S IDLE FLOAT LIVES IN THE .TSX, NOT HERE:
 * ---------------------------------------------------------------------
 * `computeIdleShoeOffset` below is a pure function of elapsed time +
 * progress — it does NOT touch `shoeGroup` itself. The scroll-driven
 * timeline in `createProductShowcaseTimeline` sets `shoeGroup`'s
 * position/rotation to absolute values on every `.progress()` call.
 * Layering a continuous idle float on top of that (in the SAME frame,
 * regardless of whether GSAP or R3F's loop runs first) only works
 * cleanly as a delta applied every rendered frame — that's a
 * useFrame/React concern, so it's `ProductShowcase.tsx`'s job.
 */

// ---------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------

export interface ProductShowcaseTargets {
  /** Experience.tsx's own camera — the same one WorldTransition targets. */
  camera: THREE.PerspectiveCamera;
  /** Experience.tsx's own shoeGroup — the same one WorldTransition targets. Never re-created, never re-loaded. */
  shoeGroup: THREE.Group;
  /** Optional restrained 3-point lighting. Intensity-only tweens are skipped gracefully if a ref is null. */
  keyLight?: THREE.PointLight | null;
  fillLight?: THREE.PointLight | null;
  rimLight?: THREE.PointLight | null;
}

export type ProductShowcaseTimeline = gsap.core.Timeline;

// ---------------------------------------------------------------------
// Stage map — the 5 conceptual ranges from the brief, used for reference
// / future debug HUDs / the detail-shot idle-float damping below. The
// actual choreography below additionally subdivides the 0.40→0.65
// "choreography" range into two waypoint segments (camera approach, then
// rotation), matching the brief's 6-beat story diagram — both sets of
// given numbers are honored, not in conflict.
// ---------------------------------------------------------------------

export interface ProductShowcaseStage {
  id: 'emergence' | 'heroPositioning' | 'choreography' | 'detailReveal' | 'finalHero';
  label: string;
  from: number;
  to: number;
}

export const PRODUCT_SHOWCASE_STAGES: readonly ProductShowcaseStage[] = [
  { id: 'emergence', label: 'Product emergence', from: 0.0, to: 0.2 },
  { id: 'heroPositioning', label: 'Hero positioning', from: 0.2, to: 0.4 },
  { id: 'choreography', label: 'Camera / product choreography', from: 0.4, to: 0.65 },
  { id: 'detailReveal', label: 'Detail reveal', from: 0.65, to: 0.85 },
  { id: 'finalHero', label: 'Final hero state', from: 0.85, to: 1.0 },
] as const;

// ---------------------------------------------------------------------
// Shoe waypoints — position/rotation/scale of the EXISTING shoeGroup.
// rotationY sweeps deliberately through silhouette (start) → three-quarter
// (0.40) → side profile (0.52) → far three-quarter / sole hint (0.65,
// via a small rotationX tilt) → detail hold (0.85) → strong three-quarter
// hero angle (1.0). No 360° loop, no continuous spin.
//
// CAVEAT: like every spatial value elsewhere in this codebase, the real
// shoe's world-space bounding size is unknown (no measured GLB — see
// AdidasShoe.tsx / SubwayStation.tsx's own caveats). These are tuned to
// "reads as a plausible hero composition," not verified geometry.
// Recalibrate once the real GLB's bounding box is known.
// ---------------------------------------------------------------------

interface ShoeWaypoint {
  /** Normalized product-sequence progress (0–1) at which the shoe ARRIVES at this pose. */
  at: number;
  position: [number, number, number];
  rotationX: number;
  rotationY: number;
  scale: number;
  /** Ease for the segment ENDING at this waypoint. Ignored for index 0. */
  ease: string;
}

export const SHOE_WAYPOINTS: readonly ShoeWaypoint[] = [
  // Assumed hand-off pose immediately after WorldTransition/TransitionAnimation.ts
  // — see file header. Small, off-center, not yet composed.
  { at: 0.0, position: [0.6, -0.3, 0.4], rotationX: 0, rotationY: 0.5, scale: 0.5, ease: 'none' },

  // Emergence (0 → 0.2): grows and drifts toward center. Deliberately NOT
  // scale 0 → massive; it's already partway there per the brief.
  { at: 0.2, position: [0.2, -0.05, 0.1], rotationX: 0, rotationY: 0.35, scale: 0.72, ease: 'power2.out' },

  // Hero positioning (0.2 → 0.4): arrives at the main composition, near-front angle.
  { at: 0.4, position: [0, 0, 0], rotationX: 0, rotationY: 0.15, scale: 1.0, ease: 'power2.inOut' },

  // Choreography, part A (0.4 → 0.52): rotates to a clean side profile.
  { at: 0.52, position: [0, 0, 0], rotationX: -0.03, rotationY: -0.65, scale: 1.05, ease: 'sine.inOut' },

  // Choreography, part B (0.52 → 0.65): swings to the far three-quarter,
  // slight forward tilt hints at the sole ahead of the detail shot.
  { at: 0.65, position: [0, 0, 0], rotationX: -0.1, rotationY: 0.95, scale: 1.08, ease: 'power1.inOut' },

  // Detail reveal (0.65 → 0.85): holds fairly steady — the CAMERA does
  // most of the work here, not the shoe.
  { at: 0.85, position: [0, 0, 0.05], rotationX: -0.06, rotationY: 0.55, scale: 1.08, ease: 'sine.inOut' },

  // Final hero (0.85 → 1.0): settles to a strong, decisive three-quarter angle.
  { at: 1.0, position: [0, 0, 0], rotationX: 0, rotationY: 0.28, scale: 1.02, ease: 'power3.out' },
] as const;

/** The assumed hand-off pose — see file header for why this is safe even if wrong. */
export const PRODUCT_STAGE_START = SHOE_WAYPOINTS[0];

// ---------------------------------------------------------------------
// Camera waypoints — WIDE → MEDIUM → CLOSE → DETAIL → HERO, per the
// brief. Positions stay close together segment-to-segment (no teleports,
// no wild orbit), tweened smoothly by GSAP.
// ---------------------------------------------------------------------

interface CameraWaypoint {
  at: number;
  position: [number, number, number];
  fov: number;
  /** World-space point the camera looks at, tweened alongside position so the look direction stays smooth as the shoe moves. */
  lookAt: [number, number, number];
  ease: string;
}

export const CAMERA_WAYPOINTS: readonly CameraWaypoint[] = [
  // WIDE — assumed hand-off camera pose. See file header caveat.
  { at: 0.0, position: [0, 1.3, 4.2], fov: 44, lookAt: [0.5, -0.15, 0.3], ease: 'none' },
  { at: 0.2, position: [0, 1.1, 3.6], fov: 42, lookAt: [0.1, 0, 0.1], ease: 'power1.inOut' },

  // MEDIUM
  { at: 0.4, position: [0, 0.95, 2.6], fov: 40, lookAt: [0, 0.05, 0], ease: 'power2.inOut' },

  // CLOSE — a gentle two-point arc that tracks the shoe's side-profile rotation.
  { at: 0.52, position: [0.6, 0.85, 1.9], fov: 37, lookAt: [0, 0.05, 0], ease: 'power1.inOut' },
  { at: 0.65, position: [-0.4, 0.9, 1.6], fov: 35, lookAt: [0, 0.05, 0], ease: 'power1.inOut' },

  // DETAIL — closest framing. Kept at a conservative distance since the
  // shoe's real bounding size is unknown (placeholder — see caveat above).
  { at: 0.85, position: [0.15, 0.55, 1.05], fov: 30, lookAt: [0.05, -0.05, 0.05], ease: 'sine.inOut' },

  // HERO — pulls back out to a clean, confident final composition.
  { at: 1.0, position: [0, 0.9, 2.1], fov: 38, lookAt: [0, 0.02, 0], ease: 'power3.out' },
] as const;

export const PRODUCT_CAMERA_START = CAMERA_WAYPOINTS[0];

// ---------------------------------------------------------------------
// Restrained 3-point lighting curve (key/fill/rim intensity only —
// positions are fixed, see KEY/FILL/RIM_LIGHT_POSITION below). Builds
// through the sequence, peaks briefly during the detail shot to bring
// out material/edge detail, settles back for the final hero frame.
// ---------------------------------------------------------------------

interface LightWaypoint {
  at: number;
  key: number;
  fill: number;
  rim: number;
  ease: string;
}

export const LIGHT_WAYPOINTS: readonly LightWaypoint[] = [
  { at: 0.0, key: 0, fill: 0.15, rim: 0, ease: 'none' },
  { at: 0.2, key: 0.8, fill: 0.5, rim: 0.15, ease: 'sine.inOut' },
  { at: 0.4, key: 2.0, fill: 0.9, rim: 0.5, ease: 'sine.inOut' },
  { at: 0.52, key: 2.4, fill: 1.0, rim: 0.75, ease: 'sine.inOut' },
  { at: 0.65, key: 2.6, fill: 1.05, rim: 1.0, ease: 'sine.inOut' },
  { at: 0.85, key: 3.2, fill: 1.1, rim: 1.7, ease: 'sine.inOut' },
  { at: 1.0, key: 2.4, fill: 1.0, rim: 0.95, ease: 'power2.out' },
] as const;

// ---------------------------------------------------------------------
// End state — single source of truth for whatever the next generation
// (HTML storytelling / product UI) treats as the resting final pose.
// Same "export the last waypoint" pattern StationAnimation.ts uses for
// STATION_END_STATE.
// ---------------------------------------------------------------------

const lastShoeWaypoint = SHOE_WAYPOINTS[SHOE_WAYPOINTS.length - 1];
const lastCameraWaypoint = CAMERA_WAYPOINTS[CAMERA_WAYPOINTS.length - 1];

export const PRODUCT_SHOWCASE_END_STATE = {
  shoe: {
    position: lastShoeWaypoint.position,
    rotationX: lastShoeWaypoint.rotationX,
    rotationY: lastShoeWaypoint.rotationY,
    scale: lastShoeWaypoint.scale,
  },
  camera: {
    position: lastCameraWaypoint.position,
    fov: lastCameraWaypoint.fov,
    lookAt: lastCameraWaypoint.lookAt,
  },
} as const;

// Fixed 3-point light positions, derived from the final hero position
// (not the live, moving shoeGroup) so only intensity animates — same
// "derive from the animation's own data" reasoning StationEffects.ts
// uses for DEFAULT_GLOW_POSITION (derived from STATION_END_STATE).
const heroX = PRODUCT_SHOWCASE_END_STATE.shoe.position[0];
const heroY = PRODUCT_SHOWCASE_END_STATE.shoe.position[1];
const heroZ = PRODUCT_SHOWCASE_END_STATE.shoe.position[2];

export const KEY_LIGHT_POSITION: readonly [number, number, number] = [heroX + 1.4, heroY + 2.0, heroZ + 2.2];
export const FILL_LIGHT_POSITION: readonly [number, number, number] = [heroX - 1.8, heroY + 0.3, heroZ + 1.6];
export const RIM_LIGHT_POSITION: readonly [number, number, number] = [heroX - 0.6, heroY + 1.3, heroZ - 2.0];

// ---------------------------------------------------------------------
// Timeline factory
// ---------------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Builds (and returns, paused) the full product-showcase GSAP timeline.
 * Call once per mount against live camera/shoeGroup/light targets, then
 * drive it via `applyProductShowcaseProgress`. Duration is exactly `1`,
 * so `timeline.progress(p)` maps directly onto 0–1 progress.
 */
export function createProductShowcaseTimeline(
  targets: ProductShowcaseTargets,
  options: { snapToStart?: boolean } = {}
): ProductShowcaseTimeline {
  const { camera, shoeGroup, keyLight = null, fillLight = null, rimLight = null } = targets;
  const { snapToStart = false } = options;

  // Optional explicit reset — off by default so this continues smoothly
  // from whatever real pose WorldTransition actually left things in.
  // Mainly useful for isolated testing before that transition is wired
  // in front of this (mirrors WorldTransition.tsx's own `snapToStationEnd`).
  if (snapToStart) {
    shoeGroup.position.set(...PRODUCT_STAGE_START.position);
    shoeGroup.rotation.set(PRODUCT_STAGE_START.rotationX, PRODUCT_STAGE_START.rotationY, 0);
    shoeGroup.scale.setScalar(PRODUCT_STAGE_START.scale);
    camera.position.set(...PRODUCT_CAMERA_START.position);
    camera.fov = PRODUCT_CAMERA_START.fov;
    camera.updateProjectionMatrix();
    if (keyLight) keyLight.intensity = LIGHT_WAYPOINTS[0].key;
    if (fillLight) fillLight.intensity = LIGHT_WAYPOINTS[0].fill;
    if (rimLight) rimLight.intensity = LIGHT_WAYPOINTS[0].rim;
  }

    // Plain Vector3 target used by camera.lookAt().
  const lookAtTarget = new THREE.Vector3(
    ...PRODUCT_CAMERA_START.lookAt
  );

  const timeline = gsap.timeline({
    paused: true,
    
    // One place, not per-segment: fires on every progress() change
    // regardless of which nested tween is currently active.
    onUpdate: () => {
      camera.updateProjectionMatrix();
      camera.lookAt(lookAtTarget);
    },
  });

  // --- Shoe: position / rotation / scale, waypoint by waypoint ---
  for (let i = 1; i < SHOE_WAYPOINTS.length; i++) {
    const prev = SHOE_WAYPOINTS[i - 1];
    const wp = SHOE_WAYPOINTS[i];
    const duration = wp.at - prev.at;

    timeline.to(
      shoeGroup.position,
      { x: wp.position[0], y: wp.position[1], z: wp.position[2], ease: wp.ease, duration },
      prev.at
    );
    timeline.to(shoeGroup.rotation, { x: wp.rotationX, y: wp.rotationY, ease: wp.ease, duration }, prev.at);
    timeline.to(shoeGroup.scale, { x: wp.scale, y: wp.scale, z: wp.scale, ease: wp.ease, duration }, prev.at);
  }

  // --- Camera: position / fov / lookAt target ---
  for (let i = 1; i < CAMERA_WAYPOINTS.length; i++) {
    const prev = CAMERA_WAYPOINTS[i - 1];
    const wp = CAMERA_WAYPOINTS[i];
    const duration = wp.at - prev.at;

    timeline.to(
      camera.position,
      { x: wp.position[0], y: wp.position[1], z: wp.position[2], ease: wp.ease, duration },
      prev.at
    );
    timeline.to(camera, { fov: wp.fov, ease: wp.ease, duration }, prev.at);
    timeline.to(
      lookAtTarget,
      { x: wp.lookAt[0], y: wp.lookAt[1], z: wp.lookAt[2], ease: wp.ease, duration },
      prev.at
    );
  }

  // --- Lights: intensity only, skipped gracefully if a ref is null ---
  const tweenLight = (light: THREE.PointLight | null, key: 'key' | 'fill' | 'rim') => {
    if (!light) return;
    for (let i = 1; i < LIGHT_WAYPOINTS.length; i++) {
      const prev = LIGHT_WAYPOINTS[i - 1];
      const wp = LIGHT_WAYPOINTS[i];
      timeline.to(light, { intensity: wp[key], ease: wp.ease, duration: wp.at - prev.at }, prev.at);
    }
  };
  tweenLight(keyLight, 'key');
  tweenLight(fillLight, 'fill');
  tweenLight(rimLight, 'rim');

  // Force an initial render at progress 0 so the very first frame matches
  // the authored start values exactly — same belt-and-braces StationAnimation.ts uses.
  timeline.progress(0);

  return timeline;
}

/** Defensive wrapper around `timeline.progress()` — clamps to 0–1. Works identically forward or backward. */
export function applyProductShowcaseProgress(timeline: ProductShowcaseTimeline, progress: number) {
  timeline.progress(clamp01(progress));
}

// ---------------------------------------------------------------------
// Idle float — a tiny, restrained, time-driven offset for the shoe,
// layered ADDITIVELY on top of the scroll-driven base pose by the
// component (see ProductShowcase.tsx's useFrame). This file only ever
// returns numbers; it never touches shoeGroup directly.
// ---------------------------------------------------------------------

export interface IdleShoeOffset {
  y: number;
  rotY: number;
}

const IDLE_FLOAT = {
  amplitudeY: 0.015,
  amplitudeRotY: 0.01,
  speedY: 0.55,
  speedRotY: 0.32,
  phaseRotY: 1.1,
} as const;

const detailStage = PRODUCT_SHOWCASE_STAGES.find((stage) => stage.id === 'detailReveal')!;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Returns a tiny sinusoidal (y, rotY) offset, automatically damped to
 * ~35% amplitude while `progress` is inside the detail-reveal stage —
 * so it never nudges the shoe out of a deliberately tight close-up —
 * and smoothly ramps back to full amplitude just outside that range.
 */
export function computeIdleShoeOffset(elapsed: number, progress: number): IdleShoeOffset {
  const enteringDetail = smoothstep(detailStage.from - 0.05, detailStage.from, progress);
  const leavingDetail = smoothstep(detailStage.to, detailStage.to + 0.05, progress);
  const detailDamp = 1 - Math.max(0, enteringDetail - leavingDetail) * 0.65;

  return {
    y: Math.sin(elapsed * IDLE_FLOAT.speedY) * IDLE_FLOAT.amplitudeY * detailDamp,
    rotY: Math.sin(elapsed * IDLE_FLOAT.speedRotY + IDLE_FLOAT.phaseRotY) * IDLE_FLOAT.amplitudeRotY * detailDamp,
  };
}
