import gsap from 'gsap';
import type * as THREE from 'three';

import { STATION_END_STATE } from './StationAnimation';

/**
 * TransitionAnimation
 * --------------------
 * Pure animation logic (no React, no JSX) for the station → shoe "world
 * transition" — the cinematic bridge between the subway-station journey
 * (`StationAnimation.ts`) and the Adidas product-showcase stage a future
 * generation builds on top of `shoeGroup` once it's in its staging pose.
 *
 * Same shape as `StationAnimation.ts`, deliberately:
 *
 *   progress (0…1) → createWorldTransitionTimeline() → HERE
 *                  → applyWorldTransitionProgress(timeline, progress)
 *
 * `createWorldTransitionTimeline()` builds ONE paused GSAP timeline once,
 * against the live objects `Experience.tsx` already owns — its bare
 * `camera` (not a `CameraRig` — see `WorldTransition.tsx`'s header),
 * `stationGroup`, and `shoeGroup`. Nothing here loads, clones, or
 * re-mounts either model.
 *
 * ---------------------------------------------------------------------
 * PROGRESS RANGE — a SEPARATE 0–1 scale from the station journey's own:
 * ---------------------------------------------------------------------
 * `StationAnimation.ts`'s progress covers Arrival → Hold, ending at
 * `STATION_END_STATE`. THIS file's progress begins exactly where that
 * ends: progress 0 = "camera at STATION_END_STATE, shoe still hidden,"
 * progress 1 = "camera + shoe both at their product-world staging
 * poses." They're two timelines in sequence, not two views of the same
 * range — whatever drives both is expected to feed station-journey
 * progress through 0→1 first, then world-transition progress through
 * 0→1 second, not both from the same raw scroll value.
 *
 * ---------------------------------------------------------------------
 * CONTINUITY — why the camera isn't `.set()` to STATION_END_STATE by
 * default:
 * ---------------------------------------------------------------------
 * `WORLD_TRANSITION_CAMERA_WAYPOINTS[0]` below equals `STATION_END_STATE`
 * for documentation and as the numeric anchor the first tween measures
 * from — but `createWorldTransitionTimeline` does NOT force the camera
 * there before building tweens (unlike `createStationJourneyTimeline`,
 * which snaps because that pose IS the page's initial resting state).
 * This timeline's progress-0 state is instead whatever the camera's
 * live position/rotation/fov already are the first time a tween here
 * renders — GSAP captures that lazily. In the fully wired pipeline
 * that's `STATION_END_STATE` exactly (the station journey left it
 * there), so behavior matches in practice, but this file never fights
 * or teleports away from whatever upstream system currently owns the
 * camera. Pass `{ snapToStationEnd: true }` to force it anyway — useful
 * for isolated testing with no station journey wired up yet.
 *
 * ---------------------------------------------------------------------
 * PLACEHOLDER CAVEAT — same as everywhere else in this codebase:
 * ---------------------------------------------------------------------
 * No real station or shoe GLB exists yet, so every position below is
 * tuned to "reads as a plausible cinematic dolly + product reveal",
 * anchored to `STATION_END_STATE` and `Experience.tsx`'s own shoe
 * staging transform — not measured geometry. Recalibrate here once real
 * geometry exists.
 */

// ---------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------

export interface WorldTransitionTargets {
  /** Experience.tsx's own camera. Never a second/new camera. */
  camera: THREE.PerspectiveCamera;
  /** Experience.tsx's `stationGroup` — the wrapper around `<SubwayStation>`. */
  stationGroup: THREE.Group;
  /** Experience.tsx's `shoeGroup` — the wrapper around `<AdidasShoe>`. */
  shoeGroup: THREE.Group;
  /** The R3F scene (`useThree().scene`), so SceneEnvironment's existing `<fog>` can be animated in place. Pass `null`/omit to skip. */
  scene?: THREE.Scene | null;
  /** The active renderer (`useThree().gl`), so its existing `toneMappingExposure` can be animated instead of a new exposure system. Pass `null`/omit to skip. */
  renderer?: THREE.WebGLRenderer | null;
}

export type WorldTransitionTimeline = gsap.core.Timeline;

export interface WorldTransitionOptions {
  /** Force the camera to STATION_END_STATE before building tweens. Default: false — see the file header's "CONTINUITY" note. */
  snapToStationEnd?: boolean;
}

// ---------------------------------------------------------------------
// Stage map — mirrors StationJourneyStage's shape for HUD/debug parity.
// ---------------------------------------------------------------------

export interface WorldTransitionStage {
  id: 'anticipation' | 'transformation' | 'passage' | 'reveal';
  label: string;
  from: number;
  to: number;
}

export const WORLD_TRANSITION_STAGES: readonly WorldTransitionStage[] = [
  { id: 'anticipation', label: 'Anticipation', from: 0.0, to: 0.2 },
  { id: 'transformation', label: 'Transformation', from: 0.2, to: 0.55 },
  { id: 'passage', label: 'Passage', from: 0.55, to: 0.8 },
  { id: 'reveal', label: 'Reveal', from: 0.8, to: 1.0 },
] as const;

const [ANTICIPATION, TRANSFORMATION, PASSAGE, REVEAL] = WORLD_TRANSITION_STAGES;

// ---------------------------------------------------------------------
// Camera path
// ---------------------------------------------------------------------

interface WorldTransitionCameraWaypoint {
  at: number;
  position: readonly [number, number, number];
  rotationY: number;
  fov: number;
  ease: string;
}

export const WORLD_TRANSITION_CAMERA_WAYPOINTS: readonly WorldTransitionCameraWaypoint[] = [
  // Start — identical to StationAnimation's STATION_END_STATE (single
  // source of truth; see file header's CONTINUITY note for why this
  // isn't force-applied by default).
  {
    at: 0.0,
    position: STATION_END_STATE.position,
    rotationY: STATION_END_STATE.rotationY,
    fov: STATION_END_STATE.fov,
    ease: 'none',
  },

  // Anticipation (0 → 0.2): barely-there creep forward. Station remains
  // visually dominant — a held breath, not a commitment yet.
  { at: ANTICIPATION.to, position: [0, 1.58, -6.3], rotationY: 0, fov: 41, ease: 'sine.inOut' },

  // Transformation (0.2 → 0.55): forward commitment begins, small
  // lateral drift + yaw — mirrors the language StationAnimation uses
  // for its own "Enter" stage.
  {
    at: TRANSFORMATION.to,
    position: [0.12, 1.5, -9.8],
    rotationY: -0.03,
    fov: 38,
    ease: 'power1.inOut',
  },

  // Passage (0.55 → 0.8): crosses the visual threshold. By this point
  // the camera has moved far enough past the station (which stays near
  // world Z≈0) that the station falls out of the view frustum on its
  // own — the camera's own forward travel IS the primary "station
  // recedes" mechanism; STATION_RECESSION_Z below is a small supporting
  // nudge, not the main driver.
  { at: PASSAGE.to, position: [0, 1.42, -13.4], rotationY: 0, fov: 35, ease: 'power2.inOut' },

  // Reveal (0.8 → 1.0): settles into the product-world framing. Lens
  // keeps tightening — a continuation of the same beat StationAnimation
  // already uses for its Approach stage (45→42), carried further here
  // (→33) as the "focus in on the product" beat.
  { at: REVEAL.to, position: [0, 1.35, -16.5], rotationY: 0, fov: 33, ease: 'power2.out' },
] as const;

// ---------------------------------------------------------------------
// Station recession — position + scale only. Never touches materials,
// visibility, or clones the group. The camera's own forward travel
// (above) does most of the work of making the station feel left behind;
// this is a small supporting nudge so the station reads as physically
// settling back, not just the camera pulling away.
// ---------------------------------------------------------------------

const STATION_RECESSION_Z = 0.7;
const STATION_RECESSION_SCALE = 0.94;

// ---------------------------------------------------------------------
// Shoe reveal — HIDDEN → SUBTLY VISIBLE → PRODUCT STAGING POSITION.
// "Hidden" is deliberately not repeated here: it's whatever
// Experience.tsx's own SHOE_STAGING already parked the group at
// (position ~[6, -2.5, -2], scale ~0.001) — this file doesn't need that
// exact value, it just tweens FROM wherever shoeGroup already is, same
// lazy-capture behavior as the camera above.
// ---------------------------------------------------------------------

/** Passage-stage midpoint — small, off-center, still clearly secondary. */
const SHOE_EMERGE_POSITION: readonly [number, number, number] = [2.4, -0.6, -15.2];
const SHOE_EMERGE_SCALE = 0.14;
const SHOE_EMERGE_ROTATION_Y = 0.5;

/** Reveal-stage final staging transform — centered, just ahead of the camera's Reveal-stage resting position above. The next generation's product showcase picks up from here. */
const SHOE_STAGING_POSITION: readonly [number, number, number] = [0, 1.1, -19];
const SHOE_STAGING_SCALE = 1;
const SHOE_STAGING_ROTATION_Y = 0.35;

// ---------------------------------------------------------------------
// Fog + exposure — integrates with SceneEnvironment's existing <fog>
// and Experience.tsx's existing gl.toneMappingExposure rather than
// inventing a second atmosphere system. Both are optional (see
// WorldTransitionTargets) and simply skipped if not supplied.
// ---------------------------------------------------------------------

const FOG_TRANSFORMATION = { near: 2, far: 16 };
const FOG_PASSAGE = { near: 1.5, far: 13 };
const FOG_REVEAL = { near: 3, far: 20 };

const EXPOSURE_TRANSFORMATION = 0.82;
const EXPOSURE_PASSAGE = 0.78;
const EXPOSURE_REVEAL = 1.15;

// ---------------------------------------------------------------------
// Timeline factory
// ---------------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Builds (and returns, paused) the full world-transition GSAP timeline.
 * Call once per mount against live Experience.tsx targets, then drive it
 * via `applyWorldTransitionProgress(timeline, progress)` on every
 * update. Duration is exactly `1`, same convention as
 * `createStationJourneyTimeline` — `timeline.progress(p)` maps directly
 * onto the 0–1 design scale, in both directions.
 */
export function createWorldTransitionTimeline(
  targets: WorldTransitionTargets,
  options: WorldTransitionOptions = {}
): WorldTransitionTimeline {
  const { camera, stationGroup, shoeGroup, scene = null, renderer = null } = targets;
  const { snapToStationEnd = false } = options;

  if (snapToStationEnd) {
    const start = WORLD_TRANSITION_CAMERA_WAYPOINTS[0];
    camera.position.set(...start.position);
    camera.rotation.set(0, start.rotationY, 0);
    camera.fov = start.fov;
    camera.updateProjectionMatrix();
  }

  const timeline = gsap.timeline({ paused: true });

  // --- Camera: position + yaw + fov, waypoint by waypoint ---
  for (let i = 1; i < WORLD_TRANSITION_CAMERA_WAYPOINTS.length; i++) {
    const prev = WORLD_TRANSITION_CAMERA_WAYPOINTS[i - 1];
    const wp = WORLD_TRANSITION_CAMERA_WAYPOINTS[i];
    const duration = wp.at - prev.at;

    timeline.to(
      camera.position,
      { x: wp.position[0], y: wp.position[1], z: wp.position[2], ease: wp.ease, duration },
      prev.at
    );
    timeline.to(camera.rotation, { y: wp.rotationY, ease: wp.ease, duration }, prev.at);
    timeline.to(
      camera,
      { fov: wp.fov, ease: wp.ease, duration, onUpdate: () => camera.updateProjectionMatrix() },
      prev.at
    );
  }

  // --- Station: subtle recession through Transformation + Passage ---
  timeline.to(
    stationGroup.position,
    { z: STATION_RECESSION_Z, ease: 'sine.inOut', duration: PASSAGE.to - ANTICIPATION.to },
    ANTICIPATION.to
  );
  timeline.to(
    stationGroup.scale,
    {
      x: STATION_RECESSION_SCALE,
      y: STATION_RECESSION_SCALE,
      z: STATION_RECESSION_SCALE,
      ease: 'sine.inOut',
      duration: PASSAGE.to - ANTICIPATION.to,
    },
    ANTICIPATION.to
  );

  // --- Shoe: begins emerging during Passage ---
  timeline.to(
    shoeGroup.position,
    {
      x: SHOE_EMERGE_POSITION[0],
      y: SHOE_EMERGE_POSITION[1],
      z: SHOE_EMERGE_POSITION[2],
      ease: 'power1.inOut',
      duration: PASSAGE.to - TRANSFORMATION.to,
    },
    TRANSFORMATION.to
  );
  timeline.to(
    shoeGroup.scale,
    {
      x: SHOE_EMERGE_SCALE,
      y: SHOE_EMERGE_SCALE,
      z: SHOE_EMERGE_SCALE,
      ease: 'power1.inOut',
      duration: PASSAGE.to - TRANSFORMATION.to,
    },
    TRANSFORMATION.to
  );
  timeline.to(
    shoeGroup.rotation,
    { y: SHOE_EMERGE_ROTATION_Y, ease: 'power1.inOut', duration: PASSAGE.to - TRANSFORMATION.to },
    TRANSFORMATION.to
  );

  // --- Shoe: reaches product staging position during Reveal ---
  timeline.to(
    shoeGroup.position,
    {
      x: SHOE_STAGING_POSITION[0],
      y: SHOE_STAGING_POSITION[1],
      z: SHOE_STAGING_POSITION[2],
      ease: 'power2.out',
      duration: REVEAL.to - PASSAGE.to,
    },
    PASSAGE.to
  );
  timeline.to(
    shoeGroup.scale,
    {
      x: SHOE_STAGING_SCALE,
      y: SHOE_STAGING_SCALE,
      z: SHOE_STAGING_SCALE,
      ease: 'power2.out',
      duration: REVEAL.to - PASSAGE.to,
    },
    PASSAGE.to
  );
  timeline.to(
    shoeGroup.rotation,
    { y: SHOE_STAGING_ROTATION_Y, ease: 'power2.out', duration: REVEAL.to - PASSAGE.to },
    PASSAGE.to
  );

  // --- Fog: deepens through Transformation + Passage, opens for a clean Reveal ---
  if (scene?.fog && 'near' in scene.fog && 'far' in scene.fog) {
    const fog = scene.fog as THREE.Fog;
    timeline.to(
      fog,
      { near: FOG_TRANSFORMATION.near, far: FOG_TRANSFORMATION.far, ease: 'sine.inOut', duration: TRANSFORMATION.to - ANTICIPATION.to },
      ANTICIPATION.to
    );
    timeline.to(
      fog,
      { near: FOG_PASSAGE.near, far: FOG_PASSAGE.far, ease: 'none', duration: PASSAGE.to - TRANSFORMATION.to },
      TRANSFORMATION.to
    );
    timeline.to(
      fog,
      { near: FOG_REVEAL.near, far: FOG_REVEAL.far, ease: 'power2.out', duration: REVEAL.to - PASSAGE.to },
      PASSAGE.to
    );
  }

  // --- Exposure: station lighting becomes "more controlled" (dimmer), then a clean product-focused lift for Reveal ---
  if (renderer) {
    timeline.to(
      renderer,
      { toneMappingExposure: EXPOSURE_TRANSFORMATION, ease: 'sine.inOut', duration: TRANSFORMATION.to - ANTICIPATION.to },
      ANTICIPATION.to
    );
    timeline.to(
      renderer,
      { toneMappingExposure: EXPOSURE_PASSAGE, ease: 'none', duration: PASSAGE.to - TRANSFORMATION.to },
      TRANSFORMATION.to
    );
    timeline.to(
      renderer,
      { toneMappingExposure: EXPOSURE_REVEAL, ease: 'power2.out', duration: REVEAL.to - PASSAGE.to },
      PASSAGE.to
    );
  }

  return timeline;
}

/** Defensive wrapper around `timeline.progress()` — clamps to 0–1. Works in both directions: a decreasing progress value un-does the tweens above exactly, same as `applyStationJourneyProgress`. */
export function applyWorldTransitionProgress(timeline: WorldTransitionTimeline, progress: number): void {
  timeline.progress(clamp01(progress));
}