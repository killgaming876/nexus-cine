/**
 * StoryTimeline
 * --------------
 * Pure, deterministic story-progress logic (no React, no JSX, no
 * Three.js, no GSAP) for Generation 8's cinematic orchestration layer.
 *
 * This file knows nothing about scroll, cameras, or any scene object —
 * it only maps a single normalized story progress value (0…1) onto:
 *
 *   - which named phase that progress falls in
 *   - how far through that phase it is (phase-local progress, 0…1)
 *   - how to remap a phase-local value back onto the master 0…1 scale
 *   - simple interpolation helpers used to drive derived values
 *     (typography opacity, etc.) from story progress
 *
 * `CinematicStory.tsx` is the only consumer — it takes the ONE existing
 * scroll-progress source (`ScrollController` / `StationJourney`'s
 * internal scroll) and asks this file "what phase / local progress does
 * this map to", then feeds phase-appropriate local progress into the
 * EXISTING animation systems (`StationAnimation`, `TransitionAnimation`,
 * `ProductAnimation`) via their own components' `setProgress` handles.
 *
 * ---------------------------------------------------------------------
 * WHY THE PHASE BOUNDARIES BELOW DIFFER SLIGHTLY FROM THE BRIEF'S
 * SUGGESTED 0.00–0.14 / 0.14–0.35 / … RANGES:
 * ---------------------------------------------------------------------
 * The brief explicitly says: "If the existing attached animation APIs
 * require slightly different boundaries, adjust them intelligently. Do
 * NOT break the existing animation architecture merely to preserve
 * these exact numbers."
 *
 * Three existing files already define their OWN internal 0…1 progress
 * scales, each meant to be fed independently, in sequence, not as three
 * views onto the same raw number:
 *
 *   - `StationAnimation.ts`     → `STATION_JOURNEY_STAGES` (5 stages)
 *   - `TransitionAnimation.ts`  → `WORLD_TRANSITION_STAGES` (4 stages)
 *   - `ProductAnimation.ts`     → `PRODUCT_SHOWCASE_STAGES` (5 stages)
 *
 * `TransitionAnimation.ts`'s own header is explicit about this: "progress
 * 0 = camera at STATION_END_STATE... whatever drives both is expected to
 * feed station-journey progress through 0→1 first, then world-transition
 * progress through 0→1 second, not both from the same raw scroll value."
 *
 * So STORY_PHASES below merges the brief's 7 named story beats with
 * those three systems' existing internal stage counts:
 *
 *   STATION_INTRO      → first slice of StationAnimation's own range
 *                         (Arrival + Enter, i.e. its first two stages)
 *   STATION_JOURNEY     → the rest of StationAnimation's range (Travel +
 *                         Approach + Hold) — together, STATION_INTRO +
 *                         STATION_JOURNEY span exactly one full 0…1 pass
 *                         of `createStationJourneyTimeline`.
 *   ATMOSPHERE_BUILD    → does NOT get its own StationAnimation slice —
 *                         CinematicAtmosphere is driven continuously
 *                         alongside BOTH station phases (see
 *                         `getAtmosphereProgress` below) because
 *                         `StationEffects.ts`'s own mood curve is
 *                         already keyed to `STATION_JOURNEY_STAGES`
 *                         directly. This phase instead marks the
 *                         *tail* of the station pass — from the start of
 *                         "Approach" through "Hold" — as the window
 *                         where atmospheric tension is foregrounded in
 *                         the narration copy, without needing a second,
 *                         competing progress source for the fog/glow.
 *   TRANSITION          → maps 1:1 onto one full pass of
 *                         `createWorldTransitionTimeline` (its own 0…1).
 *   PRODUCT_REVEAL       → first slice of ProductAnimation's own range
 *                         (Emergence + Hero positioning)
 *   PRODUCT_CINEMATIC    → middle slice (Choreography + Detail reveal)
 *   FINAL_HERO           → final slice (Final hero)
 *
 * Every phase below carries `remap`, telling `CinematicStory` exactly
 * how to convert phase-local 0…1 progress into the local 0…1 scale the
 * corresponding existing system actually expects — so no existing
 * timeline ever receives a progress value from the wrong number line.
 */

// ---------------------------------------------------------------------
// Phase identifiers
// ---------------------------------------------------------------------

export type StoryPhaseId =
  | 'STATION_INTRO'
  | 'STATION_JOURNEY'
  | 'ATMOSPHERE_BUILD'
  | 'TRANSITION'
  | 'PRODUCT_REVEAL'
  | 'PRODUCT_CINEMATIC'
  | 'FINAL_HERO';

/**
 * Which existing animation system a phase's local progress should be
 * remapped onto and fed into. `'station'` and `'transition'` and
 * `'product'` correspond 1:1 to the three existing `apply*Progress`
 * helpers; `'none'` means this phase contributes narration/atmosphere
 * emphasis only and does not by itself drive a system that isn't
 * already being driven by an overlapping phase (see ATMOSPHERE_BUILD's
 * own remap, which still targets `'station'` — it overlaps the tail of
 * STATION_JOURNEY on the master scale).
 */
export type StorySystem = 'station' | 'transition' | 'product' | 'none';

export interface StoryPhase {
  id: StoryPhaseId;
  label: string;
  /** Master story progress (0…1) at which this phase begins. */
  from: number;
  /** Master story progress (0…1) at which this phase ends. */
  to: number;
  /** Which existing system this phase's local progress feeds. */
  system: StorySystem;
  /**
   * Remaps this phase's own local 0…1 progress onto the local 0…1 scale
   * the target system's existing timeline actually expects (e.g.
   * STATION_INTRO's local 0…1 maps onto StationAnimation's own 0…0.35,
   * not a second 0…1 station timeline). Identity remap (`(t) => t`) when
   * a phase already spans a system's full 0…1 range on its own (e.g.
   * TRANSITION).
   */
  remap: (localProgress: number) => number;
  /** Short cinematic narration line for this phase. Restrained — one line, not a paragraph. */
  narration: string;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Remaps `value` from `[inMin, inMax]` to `[outMin, outMax]`, clamped. */
export function remapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax === inMin) return outMin;
  const t = clamp01((value - inMin) / (inMax - inMin));
  return lerp(outMin, outMax, t);
}

/**
 * Builds a `remap` function for a phase that occupies `[subFrom, subTo]`
 * of a target system's own 0…1 scale — e.g. STATION_INTRO occupying the
 * first 0…0.35 slice of StationAnimation's own progress scale.
 */
function subRangeRemap(subFrom: number, subTo: number): (localProgress: number) => number {
  return (localProgress: number) => lerp(subFrom, subTo, clamp01(localProgress));
}

const identityRemap = (localProgress: number): number => clamp01(localProgress);

// ---------------------------------------------------------------------
// Existing systems' own internal stage boundaries (mirrored here as
// plain numbers, NOT re-imported, to keep this file dependency-free and
// safe to import from either the client tree or a future test/debug
// context without pulling in GSAP/Three transitively). If those files'
// own stage boundaries are ever retuned, update the two constants below
// to match — see each constant's inline source comment.
// ---------------------------------------------------------------------

/** = StationAnimation.ts's STATION_JOURNEY_STAGES[1].to ('enter' stage end). */
const STATION_INTRO_END = 0.35;
/** = TransitionAnimation.ts's WORLD_TRANSITION_STAGES[1].to ('transformation' stage end) — used only as the ATMOSPHERE_BUILD tail marker below, not to remap TRANSITION itself (which is identity). */
/** = ProductAnimation.ts's PRODUCT_SHOWCASE_STAGES[1].to ('heroPositioning' stage end). */
const PRODUCT_REVEAL_END = 0.4;
/** = ProductAnimation.ts's PRODUCT_SHOWCASE_STAGES[3].to ('detailReveal' stage end). */
const PRODUCT_CINEMATIC_END = 0.85;

// ---------------------------------------------------------------------
// Story phases — master 0…1 scale
// ---------------------------------------------------------------------

export const STORY_PHASES: readonly StoryPhase[] = [
  {
    id: 'STATION_INTRO',
    label: 'Station Intro',
    from: 0.0,
    to: 0.14,
    system: 'station',
    // Occupies StationAnimation's own [0, 0.35] slice (Arrival + Enter).
    remap: subRangeRemap(0, STATION_INTRO_END),
    narration: 'THE JOURNEY BEGINS',
  },
  {
    id: 'STATION_JOURNEY',
    label: 'Station Journey',
    from: 0.14,
    to: 0.38,
    system: 'station',
    // Occupies StationAnimation's remaining [0.35, 1] slice (Travel + Approach + Hold).
    remap: subRangeRemap(STATION_INTRO_END, 1),
    narration: 'FOLLOW THE LIGHT',
  },
  {
    id: 'ATMOSPHERE_BUILD',
    label: 'Atmospheric Build',
    from: 0.38,
    to: 0.5,
    // Continues driving the station system (StationAnimation is already
    // at/near its Hold pose here — small further progress within [0.35,1]
    // keeps the camera settled while atmosphere/narration foreground the
    // mood shift; see file header). Also drives CinematicAtmosphere
    // continuously across the whole STATION_INTRO..ATMOSPHERE_BUILD span
    // via `getAtmosphereProgress` below, not through this remap.
    system: 'station',
    remap: subRangeRemap(STATION_INTRO_END, 1),
    narration: 'THE AIR CHANGES',
  },
  {
    id: 'TRANSITION',
    label: 'Transition',
    from: 0.5,
    to: 0.65,
    system: 'transition',
    // Spans TransitionAnimation's own full 0…1 range 1:1.
    remap: identityRemap,
    narration: 'BUILT FOR MOTION',
  },
  {
    id: 'PRODUCT_REVEAL',
    label: 'Product Reveal',
    from: 0.65,
    to: 0.8,
    system: 'product',
    // Occupies ProductAnimation's own [0, 0.4] slice (Emergence + Hero positioning).
    remap: subRangeRemap(0, PRODUCT_REVEAL_END),
    narration: 'THE NEXT STEP',
  },
  {
    id: 'PRODUCT_CINEMATIC',
    label: 'Product Cinematic',
    from: 0.8,
    to: 0.94,
    system: 'product',
    // Occupies ProductAnimation's own [0.4, 0.85] slice (Choreography + Detail reveal).
    remap: subRangeRemap(PRODUCT_REVEAL_END, PRODUCT_CINEMATIC_END),
    narration: 'EVERY DETAIL, DELIBERATE',
  },
  {
    id: 'FINAL_HERO',
    label: 'Final Hero',
    from: 0.94,
    to: 1.0,
    system: 'product',
    // Occupies ProductAnimation's own [0.85, 1] slice (Final hero).
    remap: subRangeRemap(PRODUCT_CINEMATIC_END, 1),
    narration: 'READY WHEN YOU ARE',
  },
] as const;

// ---------------------------------------------------------------------
// Phase lookup
// ---------------------------------------------------------------------

/**
 * Finds the phase containing `storyProgress` (0…1). Falls back to the
 * last phase for progress === 1 (or any out-of-range-high value), and
 * the first phase for any out-of-range-low value — so this never
 * returns undefined.
 */
export function getPhaseForProgress(storyProgress: number): StoryPhase {
  const p = clamp01(storyProgress);
  for (const phase of STORY_PHASES) {
    if (p < phase.to || phase.id === STORY_PHASES[STORY_PHASES.length - 1].id) {
      if (p >= phase.from) return phase;
    }
  }
  // Defensive fallback — STORY_PHASES[0].from is always 0, so p >= 0
  // always matches something above; this line is unreachable in
  // practice but keeps the return type non-optional.
  return STORY_PHASES[0];
}

/** Looks up a phase by its id directly, without needing a progress value. */
export function getPhaseById(id: StoryPhaseId): StoryPhase {
  const phase = STORY_PHASES.find((p) => p.id === id);
  if (!phase) throw new Error(`StoryTimeline: unknown phase id "${id}"`);
  return phase;
}

/**
 * Local 0…1 progress WITHIN `phase`, for a given master `storyProgress`.
 * Clamped — a `storyProgress` before/after the phase's own range returns
 * 0/1 respectively rather than a negative or >1 value, so callers can
 * pass any master progress without pre-clamping to the phase's range.
 */
export function getLocalProgress(phase: StoryPhase, storyProgress: number): number {
  return remapRange(clamp01(storyProgress), phase.from, phase.to, 0, 1);
}

/**
 * Convenience one-shot: given a master `storyProgress`, returns the
 * active phase AND that phase's already-remapped local progress (i.e.
 * exactly the value to hand to the target system's own
 * `apply*Progress`/`setProgress` call) in one call.
 */
export function resolveStoryProgress(storyProgress: number): {
  phase: StoryPhase;
  /** 0…1 progress local to the phase itself (for typography/UI timing). */
  localProgress: number;
  /** `phase.remap(localProgress)` — the value to feed the phase's target system. */
  systemProgress: number;
} {
  const phase = getPhaseForProgress(storyProgress);
  const localProgress = getLocalProgress(phase, storyProgress);
  return { phase, localProgress, systemProgress: phase.remap(localProgress) };
}

// ---------------------------------------------------------------------
// Atmosphere progress — continuous across STATION_INTRO..ATMOSPHERE_BUILD
// ---------------------------------------------------------------------

/**
 * `CinematicAtmosphere`'s own `setProgress` expects the SAME 0…1 scale
 * `StationAnimation`'s `STATION_JOURNEY_STAGES` uses (see
 * `StationEffects.ts`'s header — its mood curve is keyed directly to
 * those stage boundaries). That means atmosphere should track the
 * station system's own progress continuously through both
 * STATION_INTRO and STATION_JOURNEY (and hold at 1 through
 * ATMOSPHERE_BUILD / TRANSITION / beyond, once the station journey has
 * completed) — NOT just within a single phase's local remap.
 *
 * This derives that continuous value directly from master story
 * progress: before `STATION_JOURNEY` ends, it mirrors the same station
 * remap `STATION_INTRO`/`STATION_JOURNEY` already use; from
 * `STATION_JOURNEY`'s end onward, it holds at `1` (matching
 * StationAnimation's own Hold-stage rest state) rather than resetting or
 * running backward as later phases progress.
 */
export function getAtmosphereProgress(storyProgress: number): number {
  const stationJourney = getPhaseById('STATION_JOURNEY');
  const p = clamp01(storyProgress);
  if (p >= stationJourney.to) return 1;
  // Reuse STATION_JOURNEY's own remap logic across the combined
  // STATION_INTRO + STATION_JOURNEY span so this is one continuous
  // curve, not two spliced ones.
  return remapRange(p, 0, stationJourney.to, 0, 1);
}

// ---------------------------------------------------------------------
// Typography helpers — fade in / hold / fade out envelope local to a
// phase, used by CinematicStory.tsx to drive narration opacity/transform
// without any per-frame React state.
// ---------------------------------------------------------------------

export interface TextEnvelope {
  /** 0…1 — opacity multiplier for narration text at this local progress. */
  opacity: number;
  /** Small upward drift, in a caller-defined unit (e.g. px or rem), eases out as opacity reaches 1. */
  translateY: number;
  /** Subtle scale, settles to 1 at full opacity. */
  scale: number;
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Fade in over `[0, fadeIn]`, hold through `[fadeIn, 1 - fadeOut]`, fade
 * out over `[1 - fadeOut, 1]` — all in the phase's own local 0…1 scale.
 * Default 12%/18% in/out keeps text restrained and never abrupt.
 */
export function getTextEnvelope(
  localProgress: number,
  fadeIn = 0.12,
  fadeOut = 0.18
): TextEnvelope {
  const t = clamp01(localProgress);
  const fadeOutStart = 1 - fadeOut;
  const inT = smoothstep(0, fadeIn, t);
  const outT = 1 - smoothstep(fadeOutStart, 1, t);
  const opacity = Math.min(inT, outT);
  return {
    opacity,
    translateY: (1 - inT) * 14 - (1 - outT) * -6,
    scale: 0.985 + opacity * 0.015,
  };
}

// ---------------------------------------------------------------------
// Direction helper — for callers that want to know whether progress is
// currently increasing or decreasing (e.g. to bias narration timing),
// without maintaining their own diffing logic inline.
// ---------------------------------------------------------------------

export type ScrollDirection = 'forward' | 'backward' | 'idle';

/** Compares two consecutive progress samples and classifies direction. `epsilon` guards against floating-point noise reading as movement. */
export function getScrollDirection(
  previous: number,
  current: number,
  epsilon = 0.0001
): ScrollDirection {
  const delta = current - previous;
  if (Math.abs(delta) < epsilon) return 'idle';
  return delta > 0 ? 'forward' : 'backward';
}
