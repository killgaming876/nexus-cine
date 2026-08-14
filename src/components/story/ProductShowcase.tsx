'use client';

import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';

import {
  applyProductShowcaseProgress,
  computeIdleShoeOffset,
  createProductShowcaseTimeline,
  PRODUCT_SHOWCASE_STAGES,
  type ProductShowcaseTargets,
  type ProductShowcaseTimeline,
} from './ProductAnimation';

/**
 * ProductShowcase
 * -----------------
 * React/R3F presentation layer for the Adidas hero-product sequence.
 * Same split as `StationJourney.tsx` / `WorldTransition.tsx`:
 *
 *   scroll progress → ProductShowcase → ProductAnimation (GSAP timeline)
 *
 * ---------------------------------------------------------------------
 * GENERATION 10 FIXES:
 * ---------------------------------------------------------------------
 *   - This file previously imported `computeFloatOffset`, which does not
 *     exist in `ProductAnimation.ts` (a build-breaking import). The real
 *     export is `computeIdleShoeOffset(elapsed, progress)`, returning
 *     `{ y, rotY }` — a single vertical offset and a single Y-rotation
 *     offset, not a `{ position, rotation }` tuple pair. Fixed below.
 *   - `computeIdleShoeOffset` returns an ABSOLUTE sinusoidal value for
 *     the current instant, not a per-frame delta. The previous code did
 *     `shoeGroup.position.y += offset` every frame, which would have
 *     accumulated the full offset onto the base pose every single frame
 *     forever (unbounded drift) rather than layering a small bounded
 *     wobble. This now subtracts the PREVIOUS frame's offset before
 *     adding the new one, so the net contribution to the GSAP-driven
 *     base pose stays bounded to the intended micro-motion.
 *   - `createProductShowcaseTimeline`'s real options shape is
 *     `{ snapToStart?: boolean }` (see `ProductAnimation.ts`) — this file
 *     was passing `{ snapToEmergence }`, a key that option object does
 *     not have, so the reset-to-authored-start behavior was silently a
 *     no-op. Fixed to pass `snapToStart`.
 *
 * ---------------------------------------------------------------------
 * WHAT THIS DOES NOT DO (per the brief, and matching the pattern already
 * established by WorldTransition.tsx for this exact camera/model setup):
 * ---------------------------------------------------------------------
 *   - Does NOT mount `<AdidasShoe>`. `Experience.tsx` already mounts it
 *     once, inside `shoeGroup`. This component receives that SAME group
 *     as a `RefObject` prop and animates it — it never loads the FBX/GLB
 *     again, never clones the ~35 MB mesh graph, never creates a second
 *     shoe instance.
 *   - Does NOT create a `<Canvas>` or a camera. `Experience.tsx` owns
 *     one camera (via `CameraRig`); this component receives that same
 *     camera ref and tweens it directly, exactly like `WorldTransition`
 *     already does.
 *   - Does NOT create a scroll listener, ScrollTrigger instance, or
 *     rAF loop. It exposes `setProgress()` on an imperative handle,
 *     written into a ref and consumed inside this component's own
 *     `useFrame` for the floating micro-motion — `CinematicStory` calls
 *     `setProgress()` the same way it already calls `WorldTransition`'s.
 *   - Does NOT touch `StationAnimation`, `TransitionAnimation`, or the
 *     station in any way. `ProductAnimation.ts` only knows about
 *     `shoeGroup` + `camera`.
 *
 * ---------------------------------------------------------------------
 * WHY THE REFS ARE `RefObject`s, NOT VALUES:
 * ---------------------------------------------------------------------
 * Same reasoning `WorldTransition.tsx` already documents: passing
 * `shoeGroup={shoeGroupRef.current}` as a plain prop would read `null`
 * during `Experience.tsx`'s own render pass, before refs are attached.
 * Passing the `RefObject` itself and reading `.current` inside THIS
 * component's `useEffect` guarantees both refs are populated by the
 * time the timeline is built (React attaches all refs in a commit
 * before any `useEffect` in that tree fires).
 *
 * ---------------------------------------------------------------------
 * MOUNT LOCATION:
 * ---------------------------------------------------------------------
 * Rendered inside `CinematicStory`, which itself renders inside
 * `Experience.tsx`'s `<Canvas>`, as a sibling of `<WorldTransition />`.
 * Renders no visible JSX of its own — same as `ScrollController` /
 * `WorldTransition` returning `null`.
 */

export interface ProductShowcaseHandle {
  /** Feed this sequence's own local 0–1 progress in (the tail portion of the overall journey, remapped by StoryTimeline). Works in both directions. */
  setProgress: (progress: number) => void;
  /** Last progress value passed to `setProgress`. */
  getProgress: () => number;
  /** The live GSAP timeline, once built. Null before the first effect runs, or if the required refs never populated. */
  timeline: ProductShowcaseTimeline | null;
}

export interface ProductShowcaseProps {
  /** Experience.tsx's own camera ref. Never a new camera. */
  cameraRef: RefObject<THREE.PerspectiveCamera>;
  /** Experience.tsx's own shoeGroup ref (wraps the already-mounted `<AdidasShoe>`). Never re-loaded or cloned here. */
  shoeGroupRef: RefObject<THREE.Group | null>;
  /**
   * Snap the shoe/camera to this timeline's own authored start pose
   * before building tweens, instead of trusting whatever transform the
   * transition left them at. Default: false — mainly useful for isolated
   * testing before `WorldTransition` is actually wired in front of this.
   */
  snapToStart?: boolean;
  /** Master toggle for the restrained floating micro-motion layered on top of the scrubbed timeline. Default: true. */
  enableFloat?: boolean;
  /** Fires once the timeline is built. */
  onReady?: (handle: ProductShowcaseHandle) => void;
}

/** Re-exported for a future master timeline / debug HUD to reason about stage boundaries without importing ProductAnimation.ts directly. */
export { PRODUCT_SHOWCASE_STAGES };

export const ProductShowcase = forwardRef<ProductShowcaseHandle, ProductShowcaseProps>(
  function ProductShowcase(
    { cameraRef, shoeGroupRef, snapToStart = false, enableFloat = true, onReady },
    ref
  ) {
    const timelineRef = useRef<ProductShowcaseTimeline | null>(null);
    const progressRef = useRef(0);
    // Tracks the (y, rotY) offset actually applied to shoeGroup last
    // frame, so it can be subtracted before this frame's new offset is
    // added — keeps the idle float bounded instead of accumulating.
    const appliedFloatRef = useRef({ y: 0, rotY: 0 });

    // Build the timeline once, against the live camera/shoeGroup objects
    // Experience.tsx already owns — same "build once against live refs"
    // pattern StationJourney.tsx and WorldTransition.tsx both use.
    useEffect(() => {
      const camera = cameraRef.current;
      const shoeGroup = shoeGroupRef.current;

      if (!camera || !shoeGroup) {
        // Shouldn't happen against Experience.tsx's actual mounting order
        // (refs populate before this effect runs) — guarded defensively
        // in case ProductShowcase is ever mounted against a different
        // tree, matching WorldTransition.tsx's own guard.
        return;
      }

      const targets: ProductShowcaseTargets = { camera, shoeGroup };

      const ctx = gsap.context(() => {
        timelineRef.current = createProductShowcaseTimeline(targets, { snapToStart });
      });

      onReady?.({
        setProgress: (p) => {
          progressRef.current = p;
          if (timelineRef.current) applyProductShowcaseProgress(timelineRef.current, p);
        },
        getProgress: () => progressRef.current,
        timeline: timelineRef.current,
      });

      return () => {
        ctx.revert(); // kills the timeline and any tweens it created
        timelineRef.current = null;
      };
      // Intentionally runs once on mount only, against whatever the refs
      // point to at that time — matches StationJourney.tsx / WorldTransition.tsx.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restrained floating micro-motion, ADDITIVE on top of whatever the
    // scrubbed GSAP timeline set this frame — never fights or overwrites
    // the timeline's own authority over the base pose. Uses refs only;
    // no React state touched per frame, per the brief's performance
    // section. `computeIdleShoeOffset` returns an absolute instantaneous
    // (y, rotY) value, so the previously-applied offset is removed first
    // — otherwise this would accumulate onto the base pose every frame.
    useFrame((state) => {
      const shoeGroup = shoeGroupRef.current;
      if (!shoeGroup) return;

      const applied = appliedFloatRef.current;
      // Undo last frame's contribution before computing this frame's.
      shoeGroup.position.y -= applied.y;
      shoeGroup.rotation.y -= applied.rotY;

      if (!enableFloat) {
        applied.y = 0;
        applied.rotY = 0;
        return;
      }

      const offset = computeIdleShoeOffset(state.clock.elapsedTime, progressRef.current);
      shoeGroup.position.y += offset.y;
      shoeGroup.rotation.y += offset.rotY;
      applied.y = offset.y;
      applied.rotY = offset.rotY;
    });

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (p: number) => {
          progressRef.current = p;
          if (timelineRef.current) applyProductShowcaseProgress(timelineRef.current, p);
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
