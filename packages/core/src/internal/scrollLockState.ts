import { RefObject } from "react";

export const activeScrollLocks = new Set<symbol>();
export const activeScrollLockAllowElements = new Map<symbol, RefObject<HTMLElement | null> | undefined>();

export const scrollLockState = {
  previousBodyOverflow: null as string | null,
  previousBodyPaddingRight: null as string | null,
  globalListenersAttached: false,
  touchStartY: 0,
};

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

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
  }

  return scrollTop > 0;
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

const isTargetInAnyAllowedElement = (target: HTMLElement): boolean => {
  for (const allowedElementRef of activeScrollLockAllowElements.values()) {
    const container = allowedElementRef?.current;
    if (container && container.contains(target)) {
      return true;
    }
  }

  return false;
};

const canAllowScroll = (
  target: HTMLElement,
  source: "wheel" | "touchmove" | "keydown",
  deltaY?: number,
): boolean => {
  if (source === "keydown") {
    return isTargetInAnyAllowedElement(target);
  }

  return canAnyAllowedElementScroll(target, deltaY ?? 0);
};

const preventWheel = (e: WheelEvent) => {
  if (!(e.target instanceof HTMLElement)) {
    e.preventDefault();
    return;
  }

  if (canAllowScroll(e.target, "wheel", e.deltaY)) {
    return;
  }

  e.preventDefault();
};

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    return;
  }

  scrollLockState.touchStartY = e.touches[0].clientY;
};

const preventTouch = (e: TouchEvent) => {
  if (!(e.target instanceof HTMLElement)) {
    e.preventDefault();
    return;
  }

  if (e.touches.length === 0) {
    e.preventDefault();
    return;
  }

  const deltaY = scrollLockState.touchStartY - e.touches[0].clientY;
  if (canAllowScroll(e.target, "touchmove", deltaY)) {
    return;
  }

  e.preventDefault();
};

const preventKeyScroll = (e: KeyboardEvent) => {
  if (!SCROLL_KEYS.has(e.key)) {
    return;
  }

  if (!(e.target instanceof HTMLElement)) {
    e.preventDefault();
    return;
  }

  if (canAllowScroll(e.target, "keydown")) {
    return;
  }

  e.preventDefault();
};

export const attachScrollLockGlobalListeners = () => {
  if (scrollLockState.globalListenersAttached) {
    return;
  }

  window.addEventListener("wheel", preventWheel, { passive: false, capture: true });
  window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", preventTouch, { passive: false, capture: true });
  window.addEventListener("keydown", preventKeyScroll, { capture: true });
  scrollLockState.globalListenersAttached = true;
};

export const detachScrollLockGlobalListeners = () => {
  if (!scrollLockState.globalListenersAttached) {
    return;
  }

  window.removeEventListener("wheel", preventWheel, { capture: true });
  window.removeEventListener("touchstart", handleTouchStart, { capture: true });
  window.removeEventListener("touchmove", preventTouch, { capture: true });
  window.removeEventListener("keydown", preventKeyScroll, { capture: true });
  scrollLockState.globalListenersAttached = false;
};

export const acquireScrollLock = (
  lockId: symbol,
  allowScrollInElement?: RefObject<HTMLElement | null>,
) => {
  if (activeScrollLocks.has(lockId)) {
    activeScrollLockAllowElements.set(lockId, allowScrollInElement);
    return;
  }

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
    attachScrollLockGlobalListeners();
  }

  activeScrollLocks.add(lockId);
  activeScrollLockAllowElements.set(lockId, allowScrollInElement);
};

export const releaseScrollLock = (lockId: symbol) => {
  if (!activeScrollLocks.has(lockId)) {
    return;
  }

  activeScrollLocks.delete(lockId);
  activeScrollLockAllowElements.delete(lockId);

  if (activeScrollLocks.size === 0 && scrollLockState.previousBodyOverflow !== null) {
    document.body.style.overflow = scrollLockState.previousBodyOverflow;
    document.body.style.paddingRight = scrollLockState.previousBodyPaddingRight ?? "";
    scrollLockState.previousBodyOverflow = null;
    scrollLockState.previousBodyPaddingRight = null;
    detachScrollLockGlobalListeners();
  }
};

export const resetScrollLockTestState = () => {
  detachScrollLockGlobalListeners();
  activeScrollLocks.clear();
  activeScrollLockAllowElements.clear();
  scrollLockState.previousBodyOverflow = null;
  scrollLockState.previousBodyPaddingRight = null;
  scrollLockState.touchStartY = 0;
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
};
