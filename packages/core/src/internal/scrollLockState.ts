import { RefObject } from "react";

export const activeScrollLocks = new Set<symbol>();
export const activeScrollLockAllowElements = new Map<symbol, RefObject<HTMLElement | null> | undefined>();

export const scrollLockState = {
  previousBodyOverflow: null as string | null,
  previousBodyPaddingRight: null as string | null,
};

export const resetScrollLockTestState = () => {
  activeScrollLocks.clear();
  activeScrollLockAllowElements.clear();
  scrollLockState.previousBodyOverflow = null;
  scrollLockState.previousBodyPaddingRight = null;
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
};
