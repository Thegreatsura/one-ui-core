import React from "react";

export interface VisibleDialogLayer {
  id: string;
  dialogElement: HTMLElement;
  portalContainer: HTMLElement;
}

export const visibleDialogLayers: VisibleDialogLayer[] = [];
export const managedInertElements = new Map<HTMLElement, boolean>();

const syncVisibleDialogLayerInertState = () => {
  const nextInertElements = new Set<HTMLElement>();
  const topLayer = visibleDialogLayers[visibleDialogLayers.length - 1];

  if (topLayer) {
    document.body.childNodes.forEach((node) => {
      if (node instanceof HTMLElement && node !== topLayer.portalContainer) {
        nextInertElements.add(node);
      }
    });

    visibleDialogLayers.forEach((layer) => {
      if (layer.dialogElement !== topLayer.dialogElement) {
        nextInertElements.add(layer.dialogElement);
      }
    });
  }

  managedInertElements.forEach((wasInert, element) => {
    if (!nextInertElements.has(element)) {
      element.inert = wasInert;
      managedInertElements.delete(element);
    }
  });

  nextInertElements.forEach((element) => {
    if (!managedInertElements.has(element)) {
      managedInertElements.set(element, element.inert);
    }

    element.inert = true;
  });
};

export const upsertVisibleDialogLayer = (layer: VisibleDialogLayer) => {
  const existingIndex = visibleDialogLayers.findIndex((currentLayer) => currentLayer.id === layer.id);

  if (existingIndex === -1) {
    visibleDialogLayers.push(layer);
  } else {
    visibleDialogLayers[existingIndex] = layer;
  }

  syncVisibleDialogLayerInertState();
};

export const removeVisibleDialogLayer = (id: string) => {
  const existingIndex = visibleDialogLayers.findIndex((currentLayer) => currentLayer.id === id);
  if (existingIndex === -1) return;

  visibleDialogLayers.splice(existingIndex, 1);
  syncVisibleDialogLayerInertState();
};

export const DialogContext = React.createContext<{
  upsertVisibleDialog: (layer: VisibleDialogLayer) => void;
  removeVisibleDialog: (id: string) => void;
}>({
  upsertVisibleDialog: upsertVisibleDialogLayer,
  removeVisibleDialog: removeVisibleDialogLayer,
});
