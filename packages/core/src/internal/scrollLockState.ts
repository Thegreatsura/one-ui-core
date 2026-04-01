export const activeScrollLocks = new Set<symbol>();

export const scrollLockState = {
  previousBodyOverflow: null as string | null,
};

export const resetScrollLockTestState = () => {
  activeScrollLocks.clear();
  scrollLockState.previousBodyOverflow = null;
  document.body.style.overflow = "";
};
