import { useSyncExternalStore } from "react";

/*
 * The site-wide motion setting. Pause motion (the button in the hero) pauses
 * everything that moves: the painting and the string dividers. When the
 * visitor hasn't pressed it, prefers-reduced-motion decides.
 *
 * The visitor's choice lives here, in one module, instead of in the hero's
 * React state, so every component reads the same value. It lasts for the
 * session, including client-side navigation, but not a reload: saving it
 * (e.g. to localStorage) would mean the server-rendered page can't know it,
 * the same hydration gap #6 worked around for reduced motion. ADR-009.
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether motion is paused: the visitor's explicit choice wins; otherwise
 * prefers-reduced-motion decides. The hero's button, the painter engine,
 * and the dividers all use this, so they can't disagree.
 */
export function resolvePaused(userPaused: boolean | null, prefersReducedMotion: boolean): boolean {
  return userPaused ?? prefersReducedMotion;
}

/** The visitor's Pause motion choice, or null if they haven't pressed it. */
let userPaused: boolean | null = null;
const listeners = new Set<() => void>();

export function setUserPaused(paused: boolean | null): void {
  userPaused = paused;
  for (const listener of listeners) listener();
}

function subscribeUserPaused(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
function getUserPaused(): boolean | null {
  return userPaused;
}
function getServerUserPaused(): null {
  return null;
}

/** The visitor's Pause motion choice as React state. */
export function useUserPaused(): boolean | null {
  return useSyncExternalStore(subscribeUserPaused, getUserPaused, getServerUserPaused);
}

/*
 * prefers-reduced-motion as React state. On the server there's no media
 * query, so getServerSnapshot says "no preference"; after hydration React
 * re-reads the real value without a hydration error.
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function getServerReducedMotion(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
}

/**
 * Whether motion is paused right now. For event handlers (like a divider's
 * pluck), which run in the browser and need the current value, not React
 * state.
 */
export function isMotionPaused(): boolean {
  return resolvePaused(userPaused, window.matchMedia(REDUCED_MOTION_QUERY).matches);
}
