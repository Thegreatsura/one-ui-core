"use client";

import { useLayoutEffect, useRef, RefObject } from "react";
import {
  activeScrollLockAllowElements,
  activeScrollLocks,
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

    // Restore scroll position after a microtask to catch any scroll that happens during mount
    queueMicrotask(() => {
      window.scrollTo(scrollX, scrollY);
    });

    const canScroll = (el: HTMLElement, deltaY: number): boolean => {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;

      if (overflowY !== "auto" && overflowY !== "scroll") {
        return false;
      }

      const { scrollTop, scrollHeight, clientHeight } = el;
      const hasOverflow = scrollHeight > clientHeight;
      if (!hasOverflow) return false;

      if (deltaY > 0) {
        return scrollTop + clientHeight < scrollHeight;
      } else {
        return scrollTop > 0;
      }
    };

    const findScrollableParent = (
      target: HTMLElement,
      container: HTMLElement,
      deltaY: number,
    ): HTMLElement | null => {
      let current: HTMLElement | null = target;
      while (current && container.contains(current)) {
        if (canScroll(current, deltaY)) {
          return current;
        }
        current = current.parentElement;
      }
      // Check the container itself
      if (canScroll(container, deltaY)) {
        return container;
      }
      return null;
    };

    const canAnyAllowedElementScroll = (target: HTMLElement, deltaY: number): boolean => {
      for (const allowedElementRef of activeScrollLockAllowElements.values()) {
        const container = allowedElementRef?.current;
        if (!container || !container.contains(target)) {
          continue;
        }

        if (findScrollableParent(target, container, deltaY)) {
          return true;
        }
      }

      return false;
    };

    const preventWheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        e.preventDefault();
        return;
      }
      const target = e.target;
      if (canAnyAllowedElementScroll(target, e.deltaY)) {
        return;
      }

      e.preventDefault();
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const preventTouch = (e: TouchEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        e.preventDefault();
        return;
      }
      const target = e.target;
      const deltaY = touchStartY - e.touches[0].clientY;
      if (canAnyAllowedElementScroll(target, deltaY)) {
        return;
      }

      e.preventDefault();
    };

    const preventKeyScroll = (e: KeyboardEvent) => {
      const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
      if (scrollKeys.includes(e.key)) {
        if (!(e.target instanceof HTMLElement)) {
          e.preventDefault();
          return;
        }
        const target = e.target;
        for (const allowedElementRef of activeScrollLockAllowElements.values()) {
          const container = allowedElementRef?.current;
          if (container && container.contains(target)) {
            return;
          }
        }
        e.preventDefault();
      }
    };

    activeScrollLockAllowElements.set(lockIdRef.current, allowScrollInElement);

    window.addEventListener("wheel", preventWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", preventTouch, { passive: false, capture: true });
    window.addEventListener("keydown", preventKeyScroll, { capture: true });

    return () => {
      activeScrollLocks.delete(lockIdRef.current);
      activeScrollLockAllowElements.delete(lockIdRef.current);
      if (activeScrollLocks.size === 0 && scrollLockState.previousBodyOverflow !== null) {
        document.body.style.overflow = scrollLockState.previousBodyOverflow;
        document.body.style.paddingRight = scrollLockState.previousBodyPaddingRight ?? "";
        scrollLockState.previousBodyOverflow = null;
        scrollLockState.previousBodyPaddingRight = null;
      }

      window.removeEventListener("wheel", preventWheel, { capture: true });
      window.removeEventListener("touchstart", handleTouchStart, { capture: true });
      window.removeEventListener("touchmove", preventTouch, { capture: true });
      window.removeEventListener("keydown", preventKeyScroll, { capture: true });
    };
  }, [enabled, allowScrollInElement]);

  return null;
};
