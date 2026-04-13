"use client";

import { useLayoutEffect, useRef, RefObject } from "react";
import {
  activeScrollLockAllowElements,
  activeScrollLocks,
  attachScrollLockGlobalListeners,
  detachScrollLockGlobalListeners,
  scrollLockState,
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

    if (activeScrollLocks.size === 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      scrollLockState.previousBodyOverflow = document.body.style.overflow;
      scrollLockState.previousBodyPaddingRight = document.body.style.paddingRight;
      if (scrollbarWidth > 0) {
        const computedPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
      } else {
        document.body.style.paddingRight = "";
      }
      document.body.style.overflow = "hidden";
    }
    activeScrollLocks.add(lockIdRef.current);
    activeScrollLockAllowElements.set(lockIdRef.current, allowScrollInElement);
    if (activeScrollLocks.size === 1) {
      attachScrollLockGlobalListeners();
    }

    // Restore scroll position after a microtask to catch any scroll that happens during mount
    queueMicrotask(() => {
      window.scrollTo(scrollX, scrollY);
    });

    return () => {
      activeScrollLocks.delete(lockIdRef.current);
      activeScrollLockAllowElements.delete(lockIdRef.current);
      if (activeScrollLocks.size === 0 && scrollLockState.previousBodyOverflow !== null) {
        document.body.style.overflow = scrollLockState.previousBodyOverflow;
        document.body.style.paddingRight = scrollLockState.previousBodyPaddingRight ?? "";
        scrollLockState.previousBodyOverflow = null;
        scrollLockState.previousBodyPaddingRight = null;
        detachScrollLockGlobalListeners();
      }
    };
  }, [enabled, allowScrollInElement]);

  return null;
};
