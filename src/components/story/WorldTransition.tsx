'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';

import {
  applyWorldTransitionProgress,
  createWorldTransitionTimeline,
  type WorldTransitionTargets,
  type WorldTransitionTimeline,
} from './TransitionAnimation';

/**
 * WorldTransition
 * ----------------
 * The cinematic bridge between the subway-station scene and the Adidas
 * product-showcase scene: SUBWAY STATION → STATION END STATE → CAMERA
 * MOVEMENT → ATMOSPHERIC TRANSFORMATION → LIGHT/EXPOSURE CHANGE → SHOE
 * EMERGES → PRODUCT-WORLD STAGING.
 *
 * ---------------------------------------------------------------------
 * ARCHITECTURE THIS WAS BUILT AGAINST (from inspecting all 10 files):
 * ---------------------------------------------------------------------
 * `Experience.tsx` is the component that's actually live: it owns the
 * `<Canvas>`, a single bare `<PerspectiveCamera>` (NOT `CameraRig`), and
 * already mounts both `<SubwayStation>` (in `stationGroup`) and
 * `<AdidasShoe>` (in `shoeGroup`, parked off-stage via `SHOE_STAGING`).
 * `CameraRig.tsx`, `ScrollController.tsx`, `StationJourney.tsx`, and
 * `CinematicAtmosphere.tsx` all exist and are individually correct, but
 * NONE of them are imported by `Experience.tsx` — `StationJourney`
 * mounts its own separate `SubwayStation` + `CameraRig` +
 * `ScrollController`, entirely disconnected from `Experience.tsx`'s
 * tree. That parallel architecture is left alone rather than wired up
 * or replaced here — see the accompanying chat response for the
 * identified gap and the smallest suggested `Experience.tsx` change.
 *
 * Given that, this component:
 *   - Takes `Experience.tsx`'s own camera/stationGroup/shoeGroup refs
 *     directly instead of assuming a `CameraRig` exists to hook into.
 *   - Never mounts `<SubwayStation>` or `<AdidasShoe>` again, never
 *     creates a second camera.
 *   - Owns no scroll listener / ScrollTrigger of its own — it is purely
 *     `progress → tween state`, driven by whatever calls `setProgress()`
 *     on the handle below (a future master timeline).
 *   - Reaches `SceneEnvironment`'s fog and the renderer's exposure
 *     through `useThree()` directly (`scene.fog`, `gl`) rather than
 *     needing either file modified — `SceneEnvironment` forwards no
 *     refs, but `scene.fog` is a live, mutable object once attached, so
 *     none is needed to reach it.
 *
 * ---------------------------------------------------------------------
 * WHY THE REFS ARE `RefObject`s, NOT VALUES:
 * ---------------------------------------------------------------------
 * If `Experience.tsx` passed `camera={cameraRef.current}` as a plain
 * prop, that value would be read during `Experience`'s own render pass
 * — before refs for that render are attached — and would stay `null`
 * forever unless something forced a re-render afterward. Passing the
 * `RefObject` itself and reading `.current` inside THIS component's own
 * `useEffect` sidesteps that: React attaches every ref in a commit
 * before any `useEffect` in that tree fires, so by the time this effect
 * runs, all three refs are guaranteed populated (matching what
 * `Experience.tsx`'s own header comment already says about
 * `stationGroup`/`shoeGroup` existing "the instant Experience mounts").
 *
 * ---------------------------------------------------------------------
 * MOUNT LOCATION:
 * ---------------------------------------------------------------------
 * Render this INSIDE `Experience.tsx`'s `<Canvas>`, as a sibling of
 * `<SceneEnvironment />` and the two groups — it needs `useThree()`, so
 * it must be a Canvas child. It renders no visible output of its own,
 * same as `ScrollController` returning `null`.
 */

export interface WorldTransitionHandle {
  /** Feed a 0–1 progress value in from whatever drives this (scroll, a master timeline, a debug slider). Works in both directions. */
  setProgress: (progress: number) => void;
  /** Last progress value passed to `setProgress`. */
  getProgress: () => number;
  /** The live GSAP timeline, once built. Null before the first effect runs, or if the required refs never populated. */
  timeline: WorldTransitionTimeline | null;
}

export interface WorldTransitionProps {
  /** Experience.tsx's own camera ref. */
  cameraRef: RefObject<THREE.PerspectiveCamera>;
  /** Experience.tsx's own stationGroup ref. */
  stationGroupRef: RefObject<THREE.Group | null>;
  /** Experience.tsx's own shoeGroup ref. */
  shoeGroupRef: RefObject<THREE.Group | null>;
  /** Animate SceneEnvironment's existing scene fog. Default: true. */
  animateFog?: boolean;
  /** Animate the renderer's existing toneMappingExposure. Default: true. */
  animateExposure?: boolean;
  /**
   * Force the camera to StationAnimation's STATION_END_STATE before the
   * timeline is built, instead of relying on the camera's own live pose.
   * Default: false. See TransitionAnimation.ts's header ("CONTINUITY")
   * for the reasoning — mainly useful for isolated testing before a
   * station journey is actually wired in front of this.
   */
  snapToStationEnd?: boolean;
  /** Fires once the timeline is built. */
  onReady?: (handle: WorldTransitionHandle) => void;
}

export const WorldTransition = forwardRef<WorldTransitionHandle, WorldTransitionProps>(
  function WorldTransition(
    {
      cameraRef,
      stationGroupRef,
      shoeGroupRef,
      animateFog = true,
      animateExposure = true,
      snapToStationEnd = false,
      onReady,
    },
    ref
  ) {
    const { scene, gl } = useThree();
    const timelineRef = useRef<WorldTransitionTimeline | null>(null);
    const progressRef = useRef(0);

    // Build the timeline once, against the live camera/station/shoe
    // objects Experience.tsx already owns — same "build once against
    // live refs" pattern StationJourney.tsx uses for its own timeline.
    useEffect(() => {
      const camera = cameraRef.current;
      const stationGroup = stationGroupRef.current;
      const shoeGroup = shoeGroupRef.current;

      if (!camera || !stationGroup || !shoeGroup) {
        // Shouldn't happen against Experience.tsx's actual mounting order
        // (see this file's header) — guarded defensively in case
        // WorldTransition is ever mounted against a different tree.
        return;
      }

      const targets: WorldTransitionTargets = {
        camera,
        stationGroup,
        shoeGroup,
        scene: animateFog ? scene : null,
        renderer: animateExposure ? (gl as THREE.WebGLRenderer) : null,
      };

      const ctx = gsap.context(() => {
        timelineRef.current = createWorldTransitionTimeline(targets, { snapToStationEnd });
      });

      onReady?.({
        setProgress: (p) => {
          progressRef.current = p;
          if (timelineRef.current) applyWorldTransitionProgress(timelineRef.current, p);
        },
        getProgress: () => progressRef.current,
        timeline: timelineRef.current,
      });

      return () => {
        ctx.revert(); // kills the timeline and any tweens it created
        timelineRef.current = null;
      };
      // Intentionally runs once on mount only, against whatever the refs
      // point to at that time — matches StationJourney.tsx's own choice.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (p: number) => {
          progressRef.current = p;
          if (timelineRef.current) applyWorldTransitionProgress(timelineRef.current, p);
        },
        getProgress: () => progressRef.current,
        get timeline() {
          return timelineRef.current;
        },
      }),
      []
    );

    return null;
  }
);