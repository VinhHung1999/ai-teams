import { useEffect, useRef, useState } from "react";

export interface UseSwipeBackOptions {
  /** Called once snap-out animation completes (e.g. router.back()). */
  onTrigger: () => void;
  /** Return false to short-circuit gesture start (e.g. close drawer first). */
  shouldStart?: () => boolean;
  /** Edge zone in px from left of container. Default 20. */
  edgeWidth?: number;
  /** Trigger threshold as ratio of viewport width. Default 0.5. */
  triggerRatio?: number;
  /** Disable when innerWidth ≥ 768. Default true. */
  disableOnDesktop?: boolean;
  /** Mode: "transform" (default — return dragX for consumer to translateX) | "callback" (just fire onTrigger when threshold crossed; CSS handles transitions). */
  mode?: "transform" | "callback";
}

export interface UseSwipeBackReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  dragX: number;
  isDragging: boolean;
}

export function useSwipeBack({
  onTrigger,
  shouldStart,
  edgeWidth = 20,
  triggerRatio = 0.5,
  disableOnDesktop = true,
  mode = "transform",
}: UseSwipeBackOptions): UseSwipeBackReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Mirror live values into refs so listener closures don't go stale.
  const startXRef = useRef(0);
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const triggerRatioRef = useRef(triggerRatio);
  const onTriggerRef = useRef(onTrigger);
  const shouldStartRef = useRef(shouldStart);
  const modeRef = useRef(mode);
  useEffect(() => {
    triggerRatioRef.current = triggerRatio;
    onTriggerRef.current = onTrigger;
    shouldStartRef.current = shouldStart;
    modeRef.current = mode;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disableOnDesktop && typeof window !== "undefined" && window.innerWidth >= 768) return;

    const cancelRaf = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Single RAF loop drives both snap-back and snap-out (ease-out quad).
    const animateTo = (to: number, duration: number, done?: () => void) => {
      cancelRaf();
      const from = dragXRef.current;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t * (2 - t);
        const next = from + (to - from) * eased;
        dragXRef.current = next;
        setDragX(next);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          done?.();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      if (x > edgeWidth) return;
      if (shouldStartRef.current && !shouldStartRef.current()) return;
      cancelRaf();
      startXRef.current = x;
      draggingRef.current = true;
      dragXRef.current = 0;
      setDragX(0);
      setIsDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const x = e.touches[0].clientX;
      const dx = Math.max(0, x - startXRef.current);
      if (modeRef.current === "callback") {
        // Don't preventDefault — let native scroll proceed; don't drive React state.
        dragXRef.current = dx;
      } else {
        // Block native iOS edge swipe-back so we own the gesture.
        e.preventDefault();
        dragXRef.current = dx;
        setDragX(dx);
      }
    };

    const onTouchEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      const vw = window.innerWidth;
      const triggered = dragXRef.current >= vw * triggerRatioRef.current;
      if (modeRef.current === "callback") {
        dragXRef.current = 0;
        if (triggered) onTriggerRef.current();
        return;
      }
      animateTo(triggered ? vw : 0, 150, triggered ? () => onTriggerRef.current() : undefined);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      cancelRaf();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [edgeWidth, disableOnDesktop]);

  return { ref, dragX, isDragging };
}
