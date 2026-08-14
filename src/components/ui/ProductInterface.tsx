'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { StoryPhaseId } from '../story/StoryTimeline';

/**
 * ProductInterface
 * ------------------
 * Premium product information layer. Becomes visually relevant once the
 * cinematic story's active phase is one of the three product phases
 * (`PRODUCT_REVEAL`, `PRODUCT_CINEMATIC`, `FINAL_HERO` — the exact ids
 * `StoryTimeline.ts` already defines), and recedes otherwise. It does
 * not own progress, does not touch the shoe's 3D transform, and does not
 * duplicate `CinematicStory`'s own narration overlay — this is product
 * metadata (name / description / CTA), not the "THE NEXT STEP" style
 * narration line already rendered inside the Canvas.
 *
 * Placeholder/original copy only — no real Adidas marketing text, no
 * claims about the real product.
 */

export interface ProductInterfaceProps {
  /** Current active story phase id — pass straight through from CinematicStory. */
  activePhaseId: StoryPhaseId;
  /** Local progress (0…1) within whichever product phase is active — used only for the FINAL_HERO layout's slightly larger reveal. Optional. */
  localProgress?: number;
  productName?: string;
  productLine?: string;
  description?: string;
  metadata?: { label: string; value: string }[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
}

const PRODUCT_PHASES: StoryPhaseId[] = ['PRODUCT_REVEAL', 'PRODUCT_CINEMATIC', 'FINAL_HERO'];

const DEFAULT_METADATA = [
  { label: 'Colorway', value: 'Slate / Bone' },
  { label: 'Series', value: '01' },
];

export function ProductInterface({
  activePhaseId,
  localProgress = 0,
  productName = 'AERO FIELD',
  productLine = 'STUDIO RUNNING',
  description = 'A cinematic product statement — built for motion, shaped by restraint.',
  metadata = DEFAULT_METADATA,
  ctaLabel = 'Explore Product',
  onCtaClick,
  secondaryLabel,
  onSecondaryClick,
}: ProductInterfaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const isProductPhase = PRODUCT_PHASES.includes(activePhaseId);
  const isFinalHero = activePhaseId === 'FINAL_HERO';

  return (
    <AnimatePresence>
      {isProductPhase && (
        <motion.div
          key={isFinalHero ? 'final-hero' : 'product-panel'}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -12 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={
            isFinalHero
              ? 'pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-10 sm:px-8 sm:pb-14'
              : 'pointer-events-none fixed inset-y-0 left-5 z-30 hidden max-w-[320px] flex-col justify-center gap-5 sm:left-8 md:flex'
          }
        >
          {isFinalHero ? (
            <FinalHeroBlock
              productName={productName}
              productLine={productLine}
              description={description}
              ctaLabel={ctaLabel}
              onCtaClick={onCtaClick}
              secondaryLabel={secondaryLabel}
              onSecondaryClick={onSecondaryClick}
              reveal={Math.min(1, Math.max(0, localProgress))}
            />
          ) : (
            <ProductPanelBlock
              productName={productName}
              productLine={productLine}
              description={description}
              metadata={metadata}
              ctaLabel={ctaLabel}
              onCtaClick={onCtaClick}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------
// Sub-blocks
// ---------------------------------------------------------------------

interface PanelProps {
  productName: string;
  productLine: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

function ProductPanelBlock({
  productName,
  productLine,
  description,
  metadata,
  ctaLabel,
  onCtaClick,
}: PanelProps & { metadata: { label: string; value: string }[] }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/25 p-6 backdrop-blur-md">
      <span className="block text-[10px] font-light uppercase tracking-[0.3em] text-white/50">
        {productLine}
      </span>
      <h2 className="mt-2 text-[28px] font-light leading-[1.05] tracking-tight text-white">
        {productName}
      </h2>
      <p className="mt-3 text-[13px] font-light leading-relaxed text-white/65">{description}</p>

      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4">
        {metadata.map((item) => (
          <div key={item.label} className="flex flex-col">
            <dt className="text-[9px] font-light uppercase tracking-[0.22em] text-white/40">
              {item.label}
            </dt>
            <dd className="text-[11px] font-light text-white/80">{item.value}</dd>
          </div>
        ))}
      </dl>

      <MagneticButton onClick={onCtaClick} className="mt-6 w-full justify-center">
        {ctaLabel}
      </MagneticButton>
    </div>
  );
}

function FinalHeroBlock({
  productName,
  productLine,
  description,
  ctaLabel,
  onCtaClick,
  secondaryLabel,
  onSecondaryClick,
  reveal,
}: PanelProps & { secondaryLabel?: string; onSecondaryClick?: () => void; reveal: number }) {
  return (
    <div className="pointer-events-auto flex w-full max-w-2xl flex-col items-center text-center">
      <span className="text-[10px] font-light uppercase tracking-[0.34em] text-white/55">
        {productLine}
      </span>
      <h1
        className="mt-3 text-[clamp(2.25rem,6vw,4.25rem)] font-light leading-[0.98] tracking-tight text-white"
        style={{ opacity: 0.6 + reveal * 0.4 }}
      >
        {productName}
      </h1>
      <p className="mt-4 max-w-md text-[14px] font-light leading-relaxed text-white/70">
        {description}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <MagneticButton onClick={onCtaClick} filled>
          {ctaLabel}
        </MagneticButton>
        {secondaryLabel && (
          <button
            type="button"
            onClick={onSecondaryClick}
            className="text-[11px] font-light uppercase tracking-[0.24em] text-white/60 underline decoration-white/25 underline-offset-4 transition-colors duration-300 hover:text-white/90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/60"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * MagneticButton
 * ---------------
 * Shared CTA styling used by both product blocks. "Magnetic" is kept to a
 * restrained CSS-only hover expansion + border/opacity shift — no
 * pointer-tracking transform, to stay well inside the brief's "extremely
 * subtle" mouse-interaction guidance and avoid an extra per-move listener.
 */
function MagneticButton({
  children,
  onClick,
  filled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  filled?: boolean;
  className?: string;
}) {
  const base =
    'group relative inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[11px] font-normal uppercase tracking-[0.22em] transition-all duration-300 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4';
  const filledStyle = filled
    ? 'border-white bg-white text-black hover:bg-white/90 focus-visible:outline-white'
    : 'border-white/30 bg-transparent text-white hover:border-white/70 hover:bg-white/[0.06] focus-visible:outline-white/70';

  return (
    <button type="button" onClick={onClick} className={`${base} ${filledStyle} ${className}`}>
      <span className="transition-transform duration-300 ease-out group-hover:translate-x-[1px]">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="inline-block h-[6px] w-[6px] rotate-45 border-r border-t border-current transition-transform duration-300 ease-out group-hover:translate-x-1"
      />
    </button>
  );
}
