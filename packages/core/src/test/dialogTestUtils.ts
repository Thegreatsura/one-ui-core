import { managedInertElements, visibleDialogLayers } from "../internal/dialogState";
import { resetScrollLockTestState } from "../internal/scrollLockState";

export const resetDialogState = () => {
  visibleDialogLayers.splice(0, visibleDialogLayers.length);
  managedInertElements.clear();
  resetScrollLockTestState();
  document.body.innerHTML = "";
};
