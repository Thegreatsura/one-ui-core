"use client";

import { useLayoutEffect, useRef, RefObject } from "react";
import {
  acquireScrollLock,
  releaseScrollLock,
} from "../internal/scrollLockState";

interface ScrollLockProps {
  enabled: boolean;
  allowScrollInElement?: RefObject<HTMLElement | null>;
}

export const ScrollLock = ({ enabled, allowScrollInElement }: ScrollLockProps) => {
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  const lockIdRef = useRef(Symbol("scroll-lock"));

  useLayoutEffect(() => {
    if (!enabled) return;

    // Store current scroll position immediately
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    scrollPositionRef.current = { x: scrollX, y: scrollY };

    acquireScrollLock(lockIdRef.current, allowScrollInElement);

    // Restore scroll position after a microtask to catch any scroll that happens during mount
    queueMicrotask(() => {
      window.scrollTo(scrollX, scrollY);
    });

    return () => {
      releaseScrollLock(lockIdRef.current);
    };
  }, [enabled, allowScrollInElement]);

  return null;
};
