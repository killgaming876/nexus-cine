import gsap from 'gsap';
import type * as THREE from 'three';

/**
 * StationAnimation
 * -----------------
 * Pure animation logic (no React, no JSX) for the subway-station camera
 * journey. Builds ONE paused GSAP timeline whose 0→1 progress is meant to
 * be driven 1:1 by `ScrollController`'s smoothed `progress` value:
 *
 *   scroll → ScrollController → progress (0…1) → StationJourney → HERE
 *
 * `createStationJourneyTimeline()` builds the timeline once, against the
 * live `rig` / `head` / `camera` objects exposed by `CameraRig`. The
 * caller then just calls `timeline.progress(p)` (or the
 * `applyStationJourneyProgress` helper below) on every scroll update —
 * GSAP handles all the eased interpolation between waypoints.
 *
 * ---------------------------------------------------------------------
 * COORDINATE CONVENTION — derived from the EXISTING architecture, not
 * assumed from scratch:
 * ---------------------------------------------------------------------
 * `CameraRig`'s own defaults are `position: [0, 1.6, 9]`, `rotation: [0,
 * 0, 0]`. Identity rotation means the camera looks down its local -Z axis
 * (three.js/r3f default camera forward). That fixes the convention used
 * throughout this file:
 *   - "forward" (deeper into the station)  = decreasing Z
 *   - "right"                              = +X
 *   - eye height                           ≈ 1.6 (matches the rig default)
 *   - rotation.y (yaw), positive           = camera turns toward -X
 * `RIG_WAYPOINTS[0]` intentionally reproduces `CameraRig`'s own defaults
 * exactly, and `StationJourney.tsx` imports it to initialize the rig — so
 * there is one source of truth for the resting pose instead of two copies
 * that can drift out of sync.
 *
 * ---------------------------------------------------------------------
 * IMPORTANT CAVEAT — these waypoints are placeholders, not measurements:
 * ---------------------------------------------------------------------
 * There is currently no real station GLB (see `SubwayStation.tsx`'s own
 * header comment — only `source/station.blend` + a loose `textures/`
 * folder exist). Inspecting that .blend's datablock names directly turned
 * up no authored camera, and every mesh still carries Blender's
 * auto-generated default names (`Cube`, `Cube.001`, `Cylinder`,
 * `Cylinder.004`, `Plane.003`, …) — nothing was renamed by the artist.
 * That means even after the real glTF export lands, there won't be
 * semantic node names ("Platform", "Column", "AdPanel") to anchor a
 * camera path to.
 *
 * So: every position/rotation value below is tuned only to "reads as a
 * physically plausible human-scale walk through a corridor," anchored to
 * the ONE known reference point (the rig's existing default pose above) —
 * not to verified geometry, clearances, or wall positions. This table is
 * the single place to recalibrate once the real GLB exists (check its
 * bounding box / walk the space in Blender first).
 *
 * ---------------------------------------------------------------------
 * WHY HEAD GLANCES ARE HAND-AUTHORED DELTAS, NOT `CameraRig.lookAt()`:
 * ---------------------------------------------------------------------
 * `CameraRig.lookAt(target)` is an imperative, one-shot helper: it
 * computes `head`'s rotation from the camera's *current world position*
 * at the moment it's called, which suits being invoked reactively during
 * playback once a real target point in the scene is known. It doesn't
 * suit being pre-baked into a paused timeline built once up front — at
 * build time we don't yet know the rig's world transform at an arbitrary
 * future scroll position without actually scrubbing to get there first
 * (chicken-and-egg). Small relative `head.rotation` deltas (see
 * `STATION_HEAD_GLANCE_BEATS`) sidestep that entirely and keep everything
 * driven by the one timeline. If/when real geometry gives us actual
 * points of interest to look at, swapping these deltas for real
 * `lookAt`-derived target rotations is a localized change right here.
 */

// ---------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------

export interface StationJourneyTargets {
  /** `CameraRig`'s outer group — macro dolly position + yaw. */
  rig: THREE.Group;
  /** `CameraRig`'s inner group — secondary "glance" nudges only. */
  head: THREE.Group;
  /** `CameraRig`'s active camera — used for the lens-language FOV beat. */
  camera: THREE.PerspectiveCamera;
}

export type StationJourneyTimeline = gsap.core.Timeline;

// ---------------------------------------------------------------------
// Stage map (matches the brief's 5 stages — exported for debug HUDs /
// for the next generation to reason about where one stage ends and the
// transition-to-shoe generation should pick up).
// ---------------------------------------------------------------------

export interface StationJourneyStage {
  id: 'arrival' | 'enter' | 'travel' | 'approach' | 'hold';
  label: string;
  from: number;
  to: number;
}

export const STATION_JOURNEY_STAGES: readonly StationJourneyStage[] = [
  { id: 'arrival', label: 'Arrival', from: 0.0, to: 0.15 },
  { id: 'enter', label: 'Enter the station', from: 0.15, to: 0.35 },
  { id: 'travel', label: 'Cinematic travel', from: 0.35, to: 0.7 },
  { id: 'approach', label: 'Approach', from: 0.7, to: 0.88 },
  { id: 'hold', label: 'Hold', from: 0.88, to: 1.0 },
] as const;

// ---------------------------------------------------------------------
// Rig (macro camera) waypoints
// ---------------------------------------------------------------------

interface StationCameraWaypoint {
  /** Normalized scroll progress (0–1) at which the rig ARRIVES at this pose. */
  at: number;
  position: [number, number, number];
  /** Yaw only, radians. Pitch/roll deliberately stay 0 — see file header. */
  rotationY: number;
  /** Ease used for the segment ENDING at this waypoint. Ignored for index 0. */
  ease: string;
}

export const STATION_CAMERA_WAYPOINTS: readonly StationCameraWaypoint[] = [
  // Start — deliberately identical to CameraRig's own defaults.
  { at: 0.0, position: [0, 1.6, 9], rotationY: 0, ease: 'none' },

  // Stage 1 — Arrival (0 → 0.15): calm, barely-there creep forward.
  { at: 0.15, position: [0, 1.62, 8.4], rotationY: 0, ease: 'sine.inOut' },

  // Stage 2 — Enter the station (0.15 → 0.35): forward commitment begins,
  // small lateral drift + yaw as the camera starts reading as "in motion".
  { at: 0.35, position: [0.4, 1.55, 5.4], rotationY: -0.05, ease: 'power1.inOut' },

  // Stage 3 — Cinematic travel (0.35 → 0.7): multi-point weave, point A→D.
  { at: 0.48, position: [-0.3, 1.62, 3.0], rotationY: 0.07, ease: 'power1.inOut' }, // point B
  { at: 0.6, position: [0.25, 1.5, 0.6], rotationY: -0.05, ease: 'power2.inOut' }, // point C
  { at: 0.7, position: [0, 1.58, -1.8], rotationY: 0, ease: 'power1.inOut' }, // point D, re-centered

  // Stage 4 — Approach (0.7 → 0.88): more deliberate, building momentum.
  { at: 0.88, position: [0, 1.6, -4.4], rotationY: 0, ease: 'power2.in' },

  // Stage 5 — Hold (0.88 → 1.0): soft, decisive settle. This is the pose
  // the shoe-transition generation should treat as its starting point.
  { at: 1.0, position: [0, 1.6, -5.1], rotationY: 0, ease: 'power3.out' },
] as const;

// ---------------------------------------------------------------------
// Head (secondary) glance beats — tiny, restrained "look toward
// something" nudges layered on top of the rig's macro path during Stage
// 3. Each beat goes out, holds briefly, then returns to neutral.
// ---------------------------------------------------------------------

interface StationHeadGlanceBeat {
  out: number;
  hold: number;
  back: number;
  rotationY: number;
}

export const STATION_HEAD_GLANCE_BEATS: readonly StationHeadGlanceBeat[] = [
  { out: 0.4, hold: 0.45, back: 0.5, rotationY: 0.06 },
  { out: 0.56, hold: 0.6, back: 0.65, rotationY: -0.05 },
] as const;

// ---------------------------------------------------------------------
// FOV (lens) beat — one restrained tighten during the Approach stage.
// ---------------------------------------------------------------------

export const STATION_FOV_DEFAULT = 45;
export const STATION_FOV_APPROACH = 42;
const FOV_TIGHTEN_START = 0.7;
const FOV_TIGHTEN_END = 0.88;

// ---------------------------------------------------------------------
// End state — single source of truth for whatever the next generation
// (station → shoe transition) uses as its starting camera pose.
// ---------------------------------------------------------------------

const lastWaypoint = STATION_CAMERA_WAYPOINTS[STATION_CAMERA_WAYPOINTS.length - 1];

export const STATION_END_STATE = {
  position: lastWaypoint.position,
  rotationY: lastWaypoint.rotationY,
  fov: STATION_FOV_APPROACH,
} as const;

// ---------------------------------------------------------------------
// Timeline factory
// ---------------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Builds (and returns, paused) the full station-journey GSAP timeline.
 * Call once per mount against live `CameraRig` targets, then drive it via
 * `applyStationJourneyProgress(timeline, progress)` on every scroll
 * update. Total timeline duration is exactly `1` (a "seconds" unit that's
 * really just the 0–1 progress scale), so `timeline.progress(p)` maps
 * directly onto the design's 0–1 stage progress with no rescaling.
 */
export function createStationJourneyTimeline({
  rig,
  head,
  camera,
}: StationJourneyTargets): StationJourneyTimeline {
  const start = STATION_CAMERA_WAYPOINTS[0];

  // Snap to the authored start pose before building tweens, so repeated
  // mounts (HMR, React StrictMode double-invoke) always begin clean
  // rather than tweening from whatever transform happened to be left over.
  rig.position.set(...start.position);
  rig.rotation.set(0, start.rotationY, 0);
  head.rotation.set(0, 0, 0);
  camera.fov = STATION_FOV_DEFAULT;
  camera.updateProjectionMatrix();

  const timeline = gsap.timeline({ paused: true });

  // --- Macro dolly: rig position + yaw, waypoint by waypoint ---
  for (let i = 1; i < STATION_CAMERA_WAYPOINTS.length; i++) {
    const prev = STATION_CAMERA_WAYPOINTS[i - 1];
    const wp = STATION_CAMERA_WAYPOINTS[i];
    const duration = wp.at - prev.at;

    timeline.to(
      rig.position,
      { x: wp.position[0], y: wp.position[1], z: wp.position[2], ease: wp.ease, duration },
      prev.at
    );
    timeline.to(rig.rotation, { y: wp.rotationY, ease: wp.ease, duration }, prev.at);
  }

  // --- Secondary glances: head yaw, out and back, layered independently ---
  for (const beat of STATION_HEAD_GLANCE_BEATS) {
    timeline.to(
      head.rotation,
      { y: beat.rotationY, ease: 'sine.out', duration: beat.hold - beat.out },
      beat.out
    );
    timeline.to(
      head.rotation,
      { y: 0, ease: 'sine.inOut', duration: beat.back - beat.hold },
      beat.hold
    );
  }

  // --- Lens: one restrained tighten heading into the Approach stage ---
  timeline.to(
    camera,
    {
      fov: STATION_FOV_APPROACH,
      ease: 'power1.inOut',
      duration: FOV_TIGHTEN_END - FOV_TIGHTEN_START,
      onUpdate: () => camera.updateProjectionMatrix(),
    },
    FOV_TIGHTEN_START
  );

  // Force an initial render at progress 0 so the very first frame matches
  // the authored start pose exactly (belt-and-braces alongside the manual
  // reset above).
  timeline.progress(0);

  return timeline;
}

/** Defensive wrapper around `timeline.progress()` — clamps to 0–1. */
export function applyStationJourneyProgress(timeline: StationJourneyTimeline, progress: number) {
  timeline.progress(clamp01(progress));
}
