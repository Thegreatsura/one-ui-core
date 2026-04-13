import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";

vi.mock(".", async () => {
  const actual = await vi.importActual<typeof import(".")>(".");

  return {
    ...actual,
    IconButton: ({
      onClick,
      tooltip,
    }: {
      onClick?: () => void;
      tooltip?: string;
    }) => (
      <button aria-label={tooltip || "Close"} onClick={onClick} type="button">
        Close
      </button>
    ),
  };
});

import { Dialog, DialogProvider } from "./Dialog";
import {
  DialogContext,
  managedInertElements,
  removeVisibleDialogLayer,
  upsertVisibleDialogLayer,
  visibleDialogLayers,
} from "../internal/dialogState";
import styles from "./Dialog.module.scss";
import { resetDialogState } from "../test/dialogTestUtils";
import { LayoutProvider } from "../contexts";

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: "Dialog title",
  children: <button type="button">Primary action</button>,
};

const TestProviders = ({ children }: { children: React.ReactNode }) => (
  <LayoutProvider>{children}</LayoutProvider>
);

const renderDialog = (props: Partial<React.ComponentProps<typeof Dialog>> = {}) =>
  render(<Dialog {...defaultProps} {...props} />, {
    wrapper: TestProviders,
  });

const focusableSelector =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const getDialogPanel = (root: ParentNode = document.body) =>
  root.querySelector('[tabindex="-1"]') as HTMLElement | null;

const getOverlay = () => screen.getByRole("dialog");

const advanceTimers = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  resetDialogState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Dialog", () => {
  describe("rendering and visibility", () => {
    it("renders nothing when isOpen is false", () => {
      renderDialog({ isOpen: false });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("Dialog title")).not.toBeInTheDocument();
    });

    it("renders into the portal when isOpen is true", () => {
      renderDialog();

      expect(getOverlay()).toBeInTheDocument();
      expect(document.body).toContainElement(getOverlay());
    });

    it("sets the required accessibility attributes on the dialog overlay", () => {
      renderDialog();
      const overlay = getOverlay();
      const labelledBy = overlay.getAttribute("aria-labelledby");

      expect(overlay).toHaveAttribute("aria-modal", "true");
      expect(labelledBy).toBeTruthy();
      expect(labelledBy && document.getElementById(labelledBy)).toBeInTheDocument();
    });

    it("renders a string title", () => {
      renderDialog({ title: "Simple title" });

      expect(screen.getByText("Simple title")).toBeInTheDocument();
    });

    it("renders a ReactNode title", () => {
      renderDialog({ title: <span data-testid="custom-title">Custom title</span> });

      expect(screen.getByTestId("custom-title")).toBeInTheDocument();
    });

    it("uses unique aria-labelledby ids for stacked dialogs", () => {
      renderDialog({ title: "Base dialog", base: true });
      renderDialog({ title: "Stacked dialog", stack: true });

      const [baseDialog, stackedDialog] = screen.getAllByRole("dialog");
      const baseLabelId = baseDialog.getAttribute("aria-labelledby");
      const stackedLabelId = stackedDialog.getAttribute("aria-labelledby");

      expect(baseLabelId).toBeTruthy();
      expect(stackedLabelId).toBeTruthy();
      expect(baseLabelId).not.toBe(stackedLabelId);
      expect(baseLabelId && document.getElementById(baseLabelId)).toBeInTheDocument();
      expect(stackedLabelId && document.getElementById(stackedLabelId)).toBeInTheDocument();
    });

    it("labels the dialog correctly when title is a ReactNode", () => {
      renderDialog({ title: <span>Custom title node</span> });

      const overlay = getOverlay();
      const labelledBy = overlay.getAttribute("aria-labelledby");

      expect(labelledBy).toBeTruthy();
      expect(labelledBy && document.getElementById(labelledBy)).toHaveTextContent("Custom title node");
    });

    it("renders description when provided", () => {
      renderDialog({ description: "Helpful description" });

      expect(screen.getByText("Helpful description")).toBeInTheDocument();
    });

    it("does not render description when omitted", () => {
      renderDialog();

      expect(screen.queryByText("Helpful description")).not.toBeInTheDocument();
    });

    it("renders children inside the dialog body", () => {
      renderDialog({ children: <div>Body content</div> });

      expect(screen.getByText("Body content")).toBeInTheDocument();
    });

    it("renders footer when provided", () => {
      renderDialog({ footer: <button type="button">Confirm</button> });

      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    it("does not render footer when omitted", () => {
      renderDialog();

      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    });
  });

  describe("open and close animation state machine", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("opens visible immediately and animates after a tick", () => {
      const { rerender } = renderDialog({ isOpen: false });

      rerender(<Dialog {...defaultProps} isOpen />);

      expect(getOverlay()).toBeInTheDocument();
      expect(getOverlay()).not.toHaveClass(styles.open);

      advanceTimers(0);

      expect(getOverlay()).toHaveClass(styles.open);
    });

    it("stops animating immediately on close and hides after 300ms", () => {
      const { rerender } = renderDialog();

      advanceTimers(0);
      expect(getOverlay()).toHaveClass(styles.open);

      rerender(<Dialog {...defaultProps} isOpen={false} />);

      expect(getOverlay()).not.toHaveClass(styles.open);

      advanceTimers(299);
      expect(getOverlay()).toBeInTheDocument();

      advanceTimers(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("handles rapid open close open without leaving the dialog hidden", () => {
      const { rerender } = renderDialog({ isOpen: false });

      rerender(<Dialog {...defaultProps} isOpen />);
      rerender(<Dialog {...defaultProps} isOpen={false} />);
      rerender(<Dialog {...defaultProps} isOpen />);

      advanceTimers(0);
      advanceTimers(300);

      expect(getOverlay()).toBeInTheDocument();
      expect(getOverlay()).toHaveClass(styles.open);
    });

    it("handles rapid close open close without leaving the dialog visible", () => {
      const { rerender } = renderDialog();

      advanceTimers(0);
      rerender(<Dialog {...defaultProps} isOpen={false} />);
      rerender(<Dialog {...defaultProps} isOpen />);
      rerender(<Dialog {...defaultProps} isOpen={false} />);

      expect(getOverlay()).not.toHaveClass(styles.open);

      advanceTimers(300);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("cleans up timers on unmount", () => {
      const { unmount } = renderDialog();

      unmount();
      advanceTimers(300);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("onClose callback triggers", () => {
    // These tests rely on the file-level afterEach to restore real timers.
    it("calls onClose on Escape when base is false", () => {
      const onClose = vi.fn();
      renderDialog({ onClose, base: false });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose on Escape when base is true", () => {
      const onClose = vi.fn();
      renderDialog({ onClose, base: true });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when clicking outside while open and not base", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose, base: false });
      const outside = document.createElement("div");
      document.body.appendChild(outside);

      advanceTimers(10);
      fireEvent.mouseDown(outside, { button: 0 });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when clicking outside with a non-primary mouse button", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose, base: false });
      const outside = document.createElement("div");
      document.body.appendChild(outside);

      advanceTimers(10);
      fireEvent.mouseDown(outside, { button: 2 });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not call onClose when clicking outside with base true and stack false", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose, base: true, stack: false });
      const outside = document.createElement("div");
      document.body.appendChild(outside);

      advanceTimers(10);
      fireEvent.mouseDown(outside, { button: 0 });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when clicking outside with stack true", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose, base: true, stack: true });
      const outside = document.createElement("div");
      document.body.appendChild(outside);

      advanceTimers(10);
      fireEvent.mouseDown(outside, { button: 0 });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when clicking inside the dialog", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose, children: <button type="button">Inside content</button> });

      advanceTimers(10);
      fireEvent.mouseDown(screen.getByRole("button", { name: "Inside content" }), { button: 0 });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not call onClose when clicking inside a dropdown portal", () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDialog({ onClose });
      const dropdownPortal = document.createElement("div");
      // This class intentionally matches the implementation's dropdown portal escape hatch.
      dropdownPortal.className = "dropdown-portal";
      const dropdownItem = document.createElement("button");
      dropdownPortal.appendChild(dropdownItem);
      document.body.appendChild(dropdownPortal);

      advanceTimers(10);
      fireEvent.mouseDown(dropdownItem, { button: 0 });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when the close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onClose });

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("focus management", () => {
    it("moves focus to the first focusable element in the dialog (the close button)", () => {
      renderDialog({
        children: (
          <>
            <button type="button">First content button</button>
            <button type="button">Second content button</button>
          </>
        ),
      });

      expect(document.activeElement).toBe(screen.getByRole("button", { name: /close/i }));
    });

    it("wraps Tab from the last focusable element to the first", () => {
      renderDialog({
        children: (
          <>
            <button type="button">First content button</button>
            <button type="button">Last content button</button>
          </>
        ),
      });

      const panel = getDialogPanel();
      const buttons = screen.getAllByRole("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      last.focus();
      act(() => {
        fireEvent.keyDown(panel as HTMLElement, { key: "Tab" });
      });

      expect(document.activeElement).toBe(first);
    });

    it("wraps Shift+Tab from the first focusable element to the last", () => {
      renderDialog({
        children: (
          <>
            <button type="button">First content button</button>
            <button type="button">Last content button</button>
          </>
        ),
      });

      const panel = getDialogPanel();
      const buttons = screen.getAllByRole("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      first.focus();
      act(() => {
        fireEvent.keyDown(panel as HTMLElement, { key: "Tab", shiftKey: true });
      });

      expect(document.activeElement).toBe(last);
    });

    it("does not crash when no focusable elements are found", () => {
      const originalQuerySelectorAll = HTMLElement.prototype.querySelectorAll;
      let interceptedDialogPanelQuery = false;
      const querySelectorAllSpy = vi
        .spyOn(HTMLElement.prototype, "querySelectorAll")
        .mockImplementation(function mockDialogFocusableQuery(this: HTMLElement, selectors: string) {
          if (selectors === focusableSelector && this.getAttribute("tabindex") === "-1") {
            interceptedDialogPanelQuery = true;
            return document.createDocumentFragment().querySelectorAll(selectors);
          }

          return originalQuerySelectorAll.call(this, selectors);
        });

      try {
        expect(() => {
          renderDialog({ children: <div>Only text content</div> });
        }).not.toThrow();

        expect(interceptedDialogPanelQuery).toBe(true);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      } finally {
        querySelectorAllSpy.mockRestore();
      }
    });

    it("restores focus to the opener only after close animation completes", () => {
      vi.useFakeTimers();
      const opener = document.createElement("button");
      opener.textContent = "Open dialog";
      document.body.appendChild(opener);
      opener.focus();

      try {
        const { rerender } = renderDialog();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: /close/i }));

        rerender(<Dialog {...defaultProps} isOpen={false} />);

        expect(document.activeElement).not.toBe(opener);

        advanceTimers(299);
        expect(document.activeElement).not.toBe(opener);

        advanceTimers(1);
        expect(document.activeElement).toBe(opener);
      } finally {
        opener.remove();
      }
    });

    it("restores focus on unmount while still visible", () => {
      const opener = document.createElement("button");
      opener.textContent = "Open dialog";
      document.body.appendChild(opener);
      opener.focus();

      try {
        const { unmount } = renderDialog();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: /close/i }));

        unmount();

        expect(document.activeElement).toBe(opener);
      } finally {
        opener.remove();
      }
    });
  });

  describe("inert state management", () => {
    it("sets inert on other body children while a single dialog is open", () => {
      const sibling = document.createElement("div");
      document.body.appendChild(sibling);
      renderDialog();

      expect(sibling.inert).toBe(true);
      expect(getOverlay().inert).toBe(false);
    });

    it("restores inert to original values when a single dialog closes", () => {
      vi.useFakeTimers();
      const initiallyInert = document.createElement("div");
      initiallyInert.inert = true;
      const initiallyActive = document.createElement("div");
      document.body.append(initiallyInert, initiallyActive);
      const { rerender } = renderDialog();

      rerender(<Dialog {...defaultProps} isOpen={false} />);
      advanceTimers(300);

      expect(initiallyInert.inert).toBe(true);
      expect(initiallyActive.inert).toBe(false);
    });

    it("marks the base dialog inert when a stacked dialog opens", () => {
      renderDialog({ title: "Base dialog", base: true });
      renderDialog({ title: "Stacked dialog", stack: true });

      const [baseOverlay, stackedOverlay] = screen.getAllByRole("dialog");
      const basePanel = getDialogPanel(baseOverlay);

      expect(basePanel?.inert).toBe(true);
      expect(stackedOverlay.inert).toBe(false);
    });

    it("restores the base dialog inert state when the top dialog closes", () => {
      vi.useFakeTimers();
      renderDialog({ title: "Base dialog", base: true });
      const stackedRender = renderDialog({ title: "Stacked dialog", stack: true });
      const [baseOverlay] = screen.getAllByRole("dialog");
      const basePanel = getDialogPanel(baseOverlay) as HTMLElement;

      stackedRender.rerender(<Dialog {...defaultProps} title="Stacked dialog" isOpen={false} stack />);
      advanceTimers(300);

      expect(basePanel.inert).toBe(false);
    });

    it("does not leave orphaned inert elements after rapid open and close", () => {
      vi.useFakeTimers();
      const sibling = document.createElement("div");
      document.body.appendChild(sibling);
      const { rerender } = renderDialog({ isOpen: false });

      rerender(<Dialog {...defaultProps} isOpen />);
      rerender(<Dialog {...defaultProps} isOpen={false} />);
      rerender(<Dialog {...defaultProps} isOpen />);
      rerender(<Dialog {...defaultProps} isOpen={false} />);
      advanceTimers(300);

      expect(managedInertElements.size).toBe(0);
      expect(sibling.inert).toBe(false);
    });

    it("restores inert state when unmounted while open", () => {
      const sibling = document.createElement("div");
      document.body.appendChild(sibling);
      const { unmount } = renderDialog();

      expect(sibling.inert).toBe(true);

      unmount();

      expect(sibling.inert).toBe(false);
    });
  });

  describe("ScrollLock integration", () => {
    it('sets body overflow to "hidden" while the dialog is open', () => {
      renderDialog();

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body overflow after the dialog closes", () => {
      const { rerender } = renderDialog();

      rerender(<Dialog {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe("");
    });

    it("keeps overflow hidden until both dialogs close", () => {
      const first = renderDialog({ title: "First dialog" });
      const second = renderDialog({ title: "Second dialog", stack: true });

      expect(document.body.style.overflow).toBe("hidden");

      first.rerender(<Dialog {...defaultProps} title="First dialog" isOpen={false} />);
      expect(document.body.style.overflow).toBe("hidden");

      second.rerender(<Dialog {...defaultProps} title="Second dialog" isOpen={false} stack />);
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("onHeightChange callback", () => {
    it("calls onHeightChange with the dialog offsetHeight when visible", () => {
      const onHeightChange = vi.fn();
      const offsetHeightSpy = vi
        .spyOn(HTMLElement.prototype, "offsetHeight", "get")
        .mockReturnValue(321);

      renderDialog({ onHeightChange });

      expect(onHeightChange).toHaveBeenCalledWith(321);
      expect(offsetHeightSpy).toHaveBeenCalled();
    });

    it("does not call onHeightChange when the dialog is not visible", () => {
      const onHeightChange = vi.fn();

      renderDialog({ isOpen: false, onHeightChange });

      expect(onHeightChange).not.toHaveBeenCalled();
    });
  });

  describe("minHeight prop", () => {
    it("applies minHeight inline style when provided", () => {
      renderDialog({ minHeight: 480 });

      expect(getDialogPanel()).toHaveStyle({ minHeight: "480px" });
    });

    it("does not apply minHeight style when omitted", () => {
      renderDialog();

      expect(getDialogPanel()).not.toHaveStyle({ minHeight: "480px" });
    });
  });

  describe("base and stack props", () => {
    it("applies zIndex 8 on the overlay when base is true", () => {
      renderDialog({ base: true });

      expect(getOverlay()).toHaveClass("z-index-8");
    });

    it("applies zIndex 9 on the overlay when base is false", () => {
      renderDialog({ base: false });

      expect(getOverlay()).toHaveClass("z-index-9");
    });

    it("applies the base transform on the inner wrapper", () => {
      renderDialog({ base: true });

      expect(getOverlay().firstElementChild).toHaveStyle({
        transform: "scale(0.94) translateY(-1.25rem)",
      });
    });
  });

  describe("DialogProvider", () => {
    it("renders children correctly", () => {
      render(
        <DialogProvider>
          <div>Provider child</div>
        </DialogProvider>,
      );

      expect(screen.getByText("Provider child")).toBeInTheDocument();
    });

    it("provides the module-level context values", () => {
      const contextValues = {
        upsertVisibleDialog: undefined as
          | ((layer: {
              id: string;
              dialogElement: HTMLElement;
              portalContainer: HTMLElement;
            }) => void)
          | undefined,
        removeVisibleDialog: undefined as ((id: string) => void) | undefined,
      };

      const Consumer = () => {
        const value = React.useContext(DialogContext);
        contextValues.upsertVisibleDialog = value.upsertVisibleDialog;
        contextValues.removeVisibleDialog = value.removeVisibleDialog;

        return <div>Consumer</div>;
      };

      render(
        <DialogProvider>
          <Consumer />
        </DialogProvider>,
      );

      expect(screen.getByText("Consumer")).toBeInTheDocument();
      expect(contextValues.upsertVisibleDialog).toBe(upsertVisibleDialogLayer);
      expect(contextValues.removeVisibleDialog).toBe(removeVisibleDialogLayer);
    });

    it("registers a dialog rendered inside the provider", () => {
      render(
        <DialogProvider>
          <Dialog {...defaultProps} />
        </DialogProvider>,
        {
          wrapper: TestProviders,
        },
      );

      expect(visibleDialogLayers).toHaveLength(1);
    });
  });

  describe("SSR safety", () => {
    it("does not throw during server render when closed", () => {
      expect(() => {
        renderToString(
          <LayoutProvider>
            <Dialog {...defaultProps} isOpen={false} />
          </LayoutProvider>,
        );
      }).not.toThrow();
    });

    it("does not throw during server render when open", () => {
      vi.stubGlobal("document", undefined);
      try {
        expect(() => {
          renderToString(
            <LayoutProvider>
              <Dialog {...defaultProps} isOpen />
            </LayoutProvider>,
          );
        }).not.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
