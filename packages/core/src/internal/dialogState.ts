import React from "react";

export interface VisibleDialogLayer {
  id: string;
  dialogElement: HTMLElement;
  portalContainer: HTMLElement;
  priority?: number;
}

export const visibleDialogLayers: VisibleDialogLayer[] = [];
export const managedInertElements = new Map<HTMLElement, boolean>();

const getDialogOverlayElement = (layer: VisibleDialogLayer): HTMLElement | null =>
  layer.dialogElement.closest('[role="dialog"]');

const getOverlayZIndex = (layer: VisibleDialogLayer): number => {
  const overlayElement = getDialogOverlayElement(layer);
  if (!overlayElement || typeof window === "undefined") return 0;

  const zIndex = window.getComputedStyle(overlayElement).zIndex;
  const parsedZIndex = Number.parseInt(zIndex, 10);

  return Number.isFinite(parsedZIndex) ? parsedZIndex : 0;
};

const compareDocumentOrder = (a: Node, b: Node): number => {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);

  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;

  return 0;
};

const getVisibleLayerPriority = (layer: VisibleDialogLayer): number =>
  layer.priority ?? getOverlayZIndex(layer);

const compareVisibleLayerPriority = (a: VisibleDialogLayer, b: VisibleDialogLayer): number => {
  const explicitPriorityDifference = getVisibleLayerPriority(a) - getVisibleLayerPriority(b);
  if (explicitPriorityDifference !== 0) return explicitPriorityDifference;

  const containerOrderDifference = compareDocumentOrder(a.portalContainer, b.portalContainer);
  if (containerOrderDifference !== 0) return containerOrderDifference;

  const aOverlayElement = getDialogOverlayElement(a);
  const bOverlayElement = getDialogOverlayElement(b);

  if (aOverlayElement && bOverlayElement) {
    const overlayOrderDifference = compareDocumentOrder(aOverlayElement, bOverlayElement);
    if (overlayOrderDifference !== 0) return overlayOrderDifference;
  }

  // Use id as the final deterministic tie-breaker.
  return a.id.localeCompare(b.id);
};

const sortVisibleDialogLayersByPriority = () => {
  visibleDialogLayers.sort(compareVisibleLayerPriority);
};

const syncVisibleDialogLayerInertState = () => {
  sortVisibleDialogLayersByPriority();

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

  sortVisibleDialogLayersByPriority();
  syncVisibleDialogLayerInertState();
};

export const removeVisibleDialogLayer = (id: string) => {
  const existingIndex = visibleDialogLayers.findIndex((currentLayer) => currentLayer.id === id);
  if (existingIndex === -1) return;

  visibleDialogLayers.splice(existingIndex, 1);
  syncVisibleDialogLayerInertState();
};

export const getTopVisibleDialogLayer = (): VisibleDialogLayer | null => {
  if (visibleDialogLayers.length === 0) return null;

  sortVisibleDialogLayersByPriority();
  return visibleDialogLayers[visibleDialogLayers.length - 1] ?? null;
};

export const DialogContext = React.createContext<{
  upsertVisibleDialog: (layer: VisibleDialogLayer) => void;
  removeVisibleDialog: (id: string) => void;
}>({
  upsertVisibleDialog: upsertVisibleDialogLayer,
  removeVisibleDialog: removeVisibleDialogLayer,
});
