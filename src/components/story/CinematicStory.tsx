'use client';

import * as THREE from 'three';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

import { StationJourney, type StationJourneyHandle } from './StationJourney';
import { WorldTransition, type WorldTransitionHandle } from './WorldTransition';
import { ProductShowcase, type ProductShowcaseHandle } from './ProductShowcase';
import { CinematicAtmosphere, type CinematicAtmosphereHandle } from '../scene/CinematicAtmosphere';
import type { CameraRigHandle } from '../scene/CameraRig';
import type { SubwayStationHandle } from '../models/SubwayStation';
import {
  STORY_PHASES,
  getAtmosphereProgress,
  getScrollDirection,
  getTextEnvelope,
  resolveStoryProgress,
  type ScrollDirection,
  type StoryPhase,
  type StoryPhaseId,
} from './StoryTimeline';

/**
 * CinematicStory
 * ---------------
 * Story orchestration layer. Turns the ONE existing scroll-progress
 * source into ONE continuous cinematic film by driving the existing
 * station / atmosphere / transition / product systems off
 * `StoryTimeline.ts`'s phase map — creating none of them a second time.
 *
 * ---------------------------------------------------------------------
 * GENERATION 10 FIX — one camera, one station, everything reused:
 * ---------------------------------------------------------------------
 * Earlier generations mounted `<StationJourney onReady={...} />` with no
 * further props, which made `StationJourney` fall back to mounting its
 * OWN internal `<CameraRig>` (a second `makeDefault` camera) and its OWN
 * internal `<SubwayStation>` (a second mount of the same cached model),
 * both entirely disconnected from `Experience.tsx`'s own
 * `cameraRef`/`stationGroupRef` that `WorldTransition` and
 * `ProductShowcase` animate. That meant the station-journey camera move
 * and the transition/product camera move were literally two different
 * `THREE.PerspectiveCamera` objects — only one of which could ever be
 * the scene's actual active camera at a time.
 *
 * This component now takes `Experience.tsx`'s `cameraRigRef` (the same
 * `CameraRig` `Experience.tsx` mounts) and `subwayStationRef`, and passes
 * them straight through to `StationJourney`'s new external-rig props —
 * so `StationJourney` builds its timeline against the SAME camera/station
 * `WorldTransition`/`ProductShowcase` already animate, instead of
 * mounting a second set. `cameraRigRef.camera` is also what gets handed
 * to `WorldTransition`/`ProductShowcase` as their plain
 * `RefObject<THREE.PerspectiveCamera>` — so there really is exactly one
 * camera object for the whole experience, not two.
 *
 * ---------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH FOR SCROLL:
 * ---------------------------------------------------------------------
 * `StationJourney` is used in STANDALONE scroll mode: it mounts the one
 * and only `ScrollController`/`ScrollTrigger` instance for the whole
 * experience. `CinematicStory` reads that SAME progress value back out
 * via `StationJourney`'s own `onReady` callback
 * (`handle.scrollController.getProgress()`) rather than mounting a
 * second `ScrollController`. Every other system in this file is driven
 * from that one number via `StoryTimeline.ts`'s phase remapping —
 * nothing else reads scroll or owns a ScrollTrigger.
 *
 * ---------------------------------------------------------------------
 * WHAT THIS DOES NOT CREATE:
 * ---------------------------------------------------------------------
 *   - No second ScrollController / ScrollTrigger.
 *   - No second Canvas, renderer, or camera.
 *   - No second station or shoe model / GLB load.
 *   - No second station/transition/product animation timeline system.
 *
 * ---------------------------------------------------------------------
 * MOUNT LOCATION:
 * ---------------------------------------------------------------------
 * Render this INSIDE `Experience.tsx`'s `<Canvas>` (Experience.tsx does
 * this directly now — see that file). The cinematic narration text is
 * rendered as a plain HTML overlay via `@react-three/drei`'s `<Html>` —
 * NOT inside the WebGL scene graph — so it composites over the canvas
 * without needing a second DOM root or portal wired up by the page.
 */

// ---------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------

export interface CinematicStoryHandle {
  /** Current master story progress (0…1), last applied. */
  getProgress: () => number;
  /** Current active story phase id. */
  getPhase: () => StoryPhaseId;
  /** Current scroll direction classification. */
  getDirection: () => ScrollDirection;
}

export interface CinematicStoryProps {
  /**
   * Experience.tsx's own CameraRig ref — the ONE camera for the whole
   * experience. Passed through to StationJourney (rig/head/camera
   * targets) AND used to derive the plain PerspectiveCamera ref
   * WorldTransition/ProductShowcase tween directly.
   */
  cameraRigRef: RefObject<CameraRigHandle | null>;
  /** Experience.tsx's own stationGroup ref — passed through to StationJourney (as its station wrapper) and WorldTransition (station recession beat). */
  stationGroupRef: RefObject<THREE.Group | null>;
  /** Experience.tsx's own SubwayStation handle ref — passed through to StationJourney so it never mounts a second SubwayStation. */
  subwayStationRef: RefObject<SubwayStationHandle | null>;
  /** Experience.tsx's own shoeGroup ref (wraps the already-mounted <AdidasShoe>) — passed straight through to WorldTransition + ProductShowcase. Never re-loaded or cloned. */
  shoeGroupRef: RefObject<THREE.Group | null>;
  /** Render the restrained cinematic narration overlay. Default: true. Set false to run the story purely as a 3D/animation layer (e.g. for a debug HUD build) without any DOM text. */
  showNarration?: boolean;
  /** Quality preset forwarded to CinematicAtmosphere. Default: 'high'. */
  atmosphereQuality?: 'high' | 'medium' | 'low';
  /** Fires on every story-progress update with the resolved phase id and master progress — for an external debug HUD. Called from useFrame; do not setState from this without your own throttling. */
  onProgress?: (progress: number, phase: StoryPhaseId) => void;
}

// ---------------------------------------------------------------------
// Narration overlay — plain HTML via drei's <Html>, restrained styling
// only. No navbar/CTA/buttons/menus — a single centered line at a time,
// per the brief.
// ---------------------------------------------------------------------

interface NarrationOverlayProps {
  phase: StoryPhase;
  opacity: number;
  translateY: number;
  scale: number;
}

function NarrationOverlay({ phase, opacity, translateY, scale }: NarrationOverlayProps) {
  if (opacity <= 0.001) return null;
  // `Html` (drei) is what actually lets plain DOM render as a child of a
  // react-three-fiber scene graph / <Canvas> — a raw `<div>` returned
  // from inside the Canvas tree is not valid Three.js JSX and would not
  // render. `fullscreen` positions it as a fixed full-viewport overlay
  // (drei handles the portal), so this composites over the WebGL canvas
  // without the host page needing its own overlay DOM node.
  return (
    <Html fullscreen zIndexRange={[10, 0]} calculatePosition={() => [0, 0, 0]}>
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: '12%',
          transform: `translate(-50%, ${translateY}px) scale(${scale})`,
          opacity,
          pointerEvents: 'none',
          color: '#f2f4f7',
          fontFamily:
            '"Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontWeight: 300,
          fontSize: 'clamp(0.85rem, 1.6vw, 1.4rem)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 12px rgba(0,0,0,0.55)',
          willChange: 'transform, opacity',
        }}
        aria-hidden="true"
      >
        {phase.narration}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export const CinematicStory = forwardRef<CinematicStoryHandle, CinematicStoryProps>(
  function CinematicStory(
    {
      cameraRigRef,
      stationGroupRef,
      subwayStationRef,
      shoeGroupRef,
      showNarration = true,
      atmosphereQuality = 'high',
      onProgress,
    },
    ref
  ) {
    // ---- Handles from the three composed systems, populated via onReady ----
    const stationJourneyHandleRef = useRef<StationJourneyHandle | null>(null);
    const worldTransitionHandleRef = useRef<WorldTransitionHandle | null>(null);
    const productShowcaseHandleRef = useRef<ProductShowcaseHandle | null>(null);
    const atmosphereRef = useRef<CinematicAtmosphereHandle | null>(null);

    // Plain PerspectiveCamera ref, derived from cameraRigRef, for the two
    // systems (WorldTransition/ProductShowcase) that expect that exact
    // shape. A tiny adapter object whose `.current` getter always reads
    // through to the live rig's camera — never a second camera, never a
    // stale snapshot taken before the rig mounted.
const cameraRef = useMemo<RefObject<THREE.PerspectiveCamera>>(
  () => ({
    get current() {
      return cameraRigRef.current?.camera as THREE.PerspectiveCamera;
    },
  }),
  [cameraRigRef]
);


    // ---- Story progress bookkeeping — refs only; no per-frame React state ----
    const storyProgressRef = useRef(0);
    const previousProgressRef = useRef(0);
    const directionRef = useRef<ScrollDirection>('idle');
    const activePhaseIdRef = useRef<StoryPhaseId>(STORY_PHASES[0].id);

    // ---- Narration is the ONE piece of this file that legitimately needs
    // React state: it's DOM text, not a scene-graph mutation, so there's
    // no ref-only path to updating what's on screen. Throttled below to
    // avoid a setState on every single rAF tick. ----
    const [narrationState, setNarrationState] = useState(() => {
      const initial = resolveStoryProgress(0);
      const envelope = getTextEnvelope(initial.localProgress);
      return { phase: initial.phase, ...envelope };
    });
    const lastNarrationPhaseRef = useRef<StoryPhaseId>(narrationState.phase.id);
    const lastNarrationOpacityRef = useRef(narrationState.opacity);

    useImperativeHandle(
      ref,
      () => ({
        getProgress: () => storyProgressRef.current,
        getPhase: () => activePhaseIdRef.current,
        getDirection: () => directionRef.current,
      }),
      []
    );

    // Handlers passed to each child's `onReady` — these fire once, when
    // each child's own effect finishes building its GSAP timeline. Using
    // stable refs (not inline closures recreated per render) keeps each
    // child's own mount-once effect from re-running.
    const handleStationReady = useMemo(
      () => (handle: StationJourneyHandle) => {
        stationJourneyHandleRef.current = handle;
      },
      []
    );
    const handleTransitionReady = useMemo(
      () => (handle: WorldTransitionHandle) => {
        worldTransitionHandleRef.current = handle;
      },
      []
    );
    const handleProductReady = useMemo(
      () => (handle: ProductShowcaseHandle) => {
        productShowcaseHandleRef.current = handle;
      },
      []
    );

    // ---------------------------------------------------------------
    // The ONE per-frame driver. Reads the single scroll progress source
    // (StationJourney's internal ScrollController, standalone mode),
    // resolves it against StoryTimeline, and pushes phase-appropriate
    // local progress into whichever existing system(s) that phase
    // targets. Every write here is either a ref write or a call into an
    // existing system's own `setProgress`/`applyProgress` — never
    // `setState`, except the intentionally-throttled narration update.
    // ---------------------------------------------------------------
    useFrame(() => {
      const scrollController = stationJourneyHandleRef.current?.scrollController;
      if (!scrollController) return;

      const progress = scrollController.getProgress();

      directionRef.current = getScrollDirection(previousProgressRef.current, progress);
      previousProgressRef.current = progress;
      storyProgressRef.current = progress;

      const { phase, localProgress, systemProgress } = resolveStoryProgress(progress);
      activePhaseIdRef.current = phase.id;

      // --- Station system (StationAnimation, via StationJourney) ---
      // StationJourney already applies its OWN internal ScrollController's
      // progress to its OWN timeline every tick (see that component's
      // `handleInternalProgress`) — so during STATION_INTRO /
      // STATION_JOURNEY / ATMOSPHERE_BUILD this needs no extra write here;
      // StationJourney is already self-driving off the same single scroll
      // source this component reads.

      // --- Atmosphere (StationEffects, via CinematicAtmosphere) ---
      // Driven continuously across the combined station span, independent
      // of which single phase is "active" — see StoryTimeline's
      // `getAtmosphereProgress` header for why this isn't just
      // `systemProgress` from the station phases above.
      atmosphereRef.current?.setProgress(getAtmosphereProgress(progress));

      // --- Transition (TransitionAnimation, via WorldTransition) ---
      // WorldTransition does NOT self-drive — push TRANSITION's remapped
      // local progress explicitly whenever that phase is active. Outside
      // the TRANSITION phase, hold at 0 (before) or 1 (after) so the
      // timeline sits at its authored rest pose rather than drifting.
      if (worldTransitionHandleRef.current) {
        const transitionPhase = STORY_PHASES.find((p) => p.id === 'TRANSITION')!;
        const transitionValue =
          phase.id === 'TRANSITION'
            ? systemProgress
            : progress < transitionPhase.from
              ? 0
              : 1;
        worldTransitionHandleRef.current.setProgress(transitionValue);
      }

      // --- Product (ProductAnimation, via ProductShowcase) ---
      // Same "explicit push, hold at rest outside its own phases" pattern
      // as transition above, but spans THREE phases (REVEAL / CINEMATIC /
      // FINAL_HERO) that together cover ProductAnimation's full 0…1 range.
      if (productShowcaseHandleRef.current) {
        const productStart = STORY_PHASES.find((p) => p.id === 'PRODUCT_REVEAL')!.from;
        let productValue: number;
        if (progress < productStart) {
          productValue = 0;
        } else if (phase.system === 'product') {
          productValue = systemProgress;
        } else {
          productValue = 1;
        }
        productShowcaseHandleRef.current.setProgress(productValue);
      }

      onProgress?.(progress, phase.id);

      // --- Narration (throttled React state write) ---
      // Recompute the text envelope every frame (cheap, pure math) but
      // only call setState when the rendered phase or a meaningfully
      // different opacity actually changes, so this never becomes a
      // per-frame re-render source the way the brief explicitly warns
      // against for 3D-side state.
      const envelope = getTextEnvelope(localProgress);
      const opacityDelta = Math.abs(envelope.opacity - lastNarrationOpacityRef.current);
      const phaseChanged = phase.id !== lastNarrationPhaseRef.current;
      if (showNarration && (phaseChanged || opacityDelta > 0.01)) {
        lastNarrationPhaseRef.current = phase.id;
        lastNarrationOpacityRef.current = envelope.opacity;
        setNarrationState({ phase, ...envelope });
      }
    });

    return (
      <>
        {/*
          StationJourney: standalone SCROLL mode (no externalScroll passed,
          so it mounts the experience's single ScrollController), but
          EXTERNAL camera-rig/station mode — cameraRigRef/stationGroupRef/
          subwayStationRef all point at Experience.tsx's own objects, so
          StationJourney animates the exact same camera WorldTransition and
          ProductShowcase animate, and never mounts a second SubwayStation.
        */}
        <StationJourney
          onReady={handleStationReady}
          cameraRigRef={cameraRigRef}
          stationGroupRef={stationGroupRef}
          subwayStationRef={subwayStationRef}
        />

        {/*
          Atmosphere: driven every frame above via getAtmosphereProgress,
          independent of which single phase happens to be active.
        */}
        <CinematicAtmosphere ref={atmosphereRef} quality={atmosphereQuality} />

        {/*
          Transition + Product: both target the SAME camera (derived from
          cameraRigRef above) / stationGroup / shoeGroup StationJourney
          just animated — never a second camera. Neither self-drives; both
          are pushed explicitly above.
        */}
        <WorldTransition
          cameraRef={cameraRef}
          stationGroupRef={stationGroupRef}
          shoeGroupRef={shoeGroupRef}
          onReady={handleTransitionReady}
        />
        <ProductShowcase
          cameraRef={cameraRef}
          shoeGroupRef={shoeGroupRef}
          onReady={handleProductReady}
        />

        {showNarration && (
          <NarrationOverlay
            phase={narrationState.phase}
            opacity={narrationState.opacity}
            translateY={narrationState.translateY}
            scale={narrationState.scale}
          />
        )}
      </>
    );
  }
);
