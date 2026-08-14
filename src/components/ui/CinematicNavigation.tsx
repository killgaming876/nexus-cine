'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * CinematicNavigation
 * ---------------------
 * Minimal, editorial navigation that sits above the existing cinematic
 * 3D experience (`Experience.tsx` / `CinematicStory.tsx`). This file owns
 * NO scroll logic, NO story state, and NO 3D objects — it is a pure
 * presentational overlay. Section state is driven by whatever calls
 * `activePhase` in from `CinematicStory`'s existing progress source (see
 * `CinematicUI.tsx`), never a second scroll listener.
 *
 * Visual language: near-black glass, hairline borders, restrained
 * uppercase tracking, no gradients, no glow. Built to read as a premium
 * campaign site, not a dashboard.
 */

export interface NavLink {
  label: string;
  /** Story phase id (from StoryTimeline.ts) this link conceptually maps to, for active-state styling only. Optional — purely cosmetic, not a scroll target unless `onNavigate` is wired to one. */
  matchPhases?: string[];
}

export interface CinematicNavigationProps {
  /** Brand wordmark. Kept as text, not a logo asset, since no asset pipeline was provided. */
  brand?: string;
  links?: NavLink[];
  /** Label for the primary right-side action. */
  ctaLabel?: string;
  /** Fires when the CTA is clicked. Left for the integration layer to wire to a real destination/scroll target. */
  onCtaClick?: () => void;
  /** Fires when a nav link is clicked, with its index into `links`. Left for the integration layer to decide what "navigate" means (smooth-scroll to a page fraction, route change, etc.) since no router/page structure was provided. */
  onLinkClick?: (index: number) => void;
  /** Current story phase id, used only to lightly highlight the closest-matching link. Pass this through from CinematicStory's handle. */
  activePhaseId?: string;
  /** Hide the bar entirely (e.g. during an intentional full-bleed moment). Default: false. */
  hidden?: boolean;
}

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Journey', matchPhases: ['STATION_INTRO', 'STATION_JOURNEY', 'ATMOSPHERE_BUILD'] },
  { label: 'Product', matchPhases: ['PRODUCT_REVEAL', 'PRODUCT_CINEMATIC', 'FINAL_HERO'] },
  { label: 'About' },
];

export function CinematicNavigation({
  brand = 'STUDIO',
  links = DEFAULT_LINKS,
  ctaLabel = 'Shop',
  onCtaClick,
  onLinkClick,
  activePhaseId,
  hidden = false,
}: CinematicNavigationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Purely cosmetic scroll read (bar becomes slightly denser once the
  // page has moved) — a plain passive listener, not a progress source.
  // This never feeds back into the cinematic story; StationJourney's own
  // ScrollController remains the only progress authority.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on Escape for keyboard users.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <motion.header
      initial={false}
      animate={{ y: hidden ? -96 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      style={{ pointerEvents: hidden ? 'none' : 'auto' }}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        {/* Brand */}
        <a
          href="#top"
          className="pointer-events-auto text-[13px] font-light tracking-[0.32em] text-white/90 transition-colors duration-300 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/60"
        >
          {brand}
        </a>

        {/* Desktop links + CTA, glass pill */}
        <div
          className="pointer-events-auto hidden items-center gap-1 rounded-full border border-white/10 bg-black/30 px-1.5 py-1.5 backdrop-blur-md md:flex"
          style={{
            backgroundColor: scrolled ? 'rgba(8,9,11,0.55)' : 'rgba(8,9,11,0.28)',
            transition: 'background-color 400ms ease',
          }}
        >
          <nav aria-label="Primary" className="flex items-center">
            {links.map((link, i) => {
              const isActive = activePhaseId ? link.matchPhases?.includes(activePhaseId) : false;
              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => onLinkClick?.(i)}
                  aria-current={isActive ? 'true' : undefined}
                  className="group relative rounded-full px-4 py-2 text-[11px] font-light uppercase tracking-[0.22em] text-white/60 transition-colors duration-300 hover:text-white/95 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                  style={{ color: isActive ? 'rgba(255,255,255,0.95)' : undefined }}
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-4 -bottom-0.5 h-px origin-left scale-x-0 bg-white/70 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ transform: isActive ? 'scaleX(1)' : undefined }}
                  />
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onCtaClick}
            className="ml-1 rounded-full border border-white/25 px-5 py-2 text-[11px] font-normal uppercase tracking-[0.22em] text-white transition-all duration-300 hover:border-white/60 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            {ctaLabel}
          </button>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 backdrop-blur-md md:hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          <span className="relative block h-3 w-4">
            <span
              className="absolute left-0 top-0 block h-px w-4 bg-white/85 transition-transform duration-300"
              style={{ transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none' }}
            />
            <span
              className="absolute left-0 bottom-0 block h-px w-4 bg-white/85 transition-transform duration-300"
              style={{ transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }}
            />
          </span>
        </button>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
            className="pointer-events-auto mx-4 mt-1 overflow-hidden rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md md:hidden"
          >
            <nav aria-label="Primary mobile" className="flex flex-col divide-y divide-white/10">
              {links.map((link, i) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => {
                    onLinkClick?.(i);
                    setMenuOpen(false);
                  }}
                  className="px-5 py-4 text-left text-[12px] font-light uppercase tracking-[0.22em] text-white/75 transition-colors hover:text-white"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  onCtaClick?.();
                  setMenuOpen(false);
                }}
                className="px-5 py-4 text-left text-[12px] font-normal uppercase tracking-[0.22em] text-white"
              >
                {ctaLabel}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
