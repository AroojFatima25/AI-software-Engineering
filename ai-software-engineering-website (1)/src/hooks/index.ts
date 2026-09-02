import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Reactive CSS media query. */
export function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : defaultValue));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Observes an element's content width. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Cycles an index from 0..length-1 on an interval.
 * `running` pauses the cycle (e.g. when hovered or out of view).
 */
export function useCycle(length: number, intervalMs: number, running = true) {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0); // used to restart the progress animation when user selects manually

  useEffect(() => {
    if (!running || length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % length);
      setTick((t) => t + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [length, intervalMs, running, tick]);

  const select = useCallback((i: number) => {
    setIndex(i);
    setTick((t) => t + 1);
  }, []);

  return { index, select, tick };
}

/**
 * Steps a counter forward on an interval, holds at the end, then restarts.
 * Useful for sequential pipeline animations.
 */
export function useSequence(steps: number, stepMs: number, holdMs: number, running = true) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timeout: number;

    const advance = (next: number) => {
      if (cancelled) return;
      setStep(next);
      if (next >= steps - 1) {
        timeout = window.setTimeout(() => advance(-1), holdMs);
      } else {
        timeout = window.setTimeout(() => advance(next + 1), next === -1 ? 400 : stepMs);
      }
    };

    advance(-1);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [steps, stepMs, holdMs, running]);

  return step;
}
