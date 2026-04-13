import React, { useRef } from "react";
import { render } from "@testing-library/react";
import { ScrollLock } from "./ScrollLock";
import { resetScrollLockTestState } from "../internal/scrollLockState";

const defineScrollMetrics = (
  element: HTMLElement,
  {
    scrollTop = 0,
    scrollHeight = 400,
    clientHeight = 100,
  }: {
    scrollTop?: number;
    scrollHeight?: number;
    clientHeight?: number;
  } = {},
) => {
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
};

const createTouchEvent = (type: string, clientY: number) => {
  // jsdom touch support is limited, so we emulate the minimal TouchEvent shape we need.
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, "touches", {
    configurable: true,
    value: [{ clientY }],
  });

  return event;
};

const ScrollLockHarness = ({
  enabled = true,
  includeAllowedElement = false,
  scrollable = false,
}: {
  enabled?: boolean;
  includeAllowedElement?: boolean;
  scrollable?: boolean;
}) => {
  const allowedRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {includeAllowedElement && (
        <div ref={allowedRef} data-testid="allowed-root">
          <div
            data-testid="allowed-scrollable"
            style={{ overflowY: scrollable ? "auto" : "visible" }}
          >
            <button type="button">Allowed child</button>
          </div>
        </div>
      )}
      <button type="button">Outside child</button>
      <ScrollLock enabled={enabled} allowScrollInElement={includeAllowedElement ? allowedRef : undefined} />
    </>
  );
};

const DualScrollLockHarness = () => {
  const baseAllowedRef = useRef<HTMLDivElement>(null);
  const topAllowedRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div ref={baseAllowedRef} data-testid="base-allowed-root">
        <div data-testid="base-scrollable" style={{ overflowY: "auto" }}>
          <button type="button">Base allowed child</button>
        </div>
      </div>
      <div ref={topAllowedRef} data-testid="top-allowed-root">
        <div data-testid="top-scrollable" style={{ overflowY: "auto" }}>
          <button type="button">Top allowed child</button>
        </div>
      </div>
      <button type="button">Outside child</button>
      <ScrollLock enabled allowScrollInElement={baseAllowedRef} />
      <ScrollLock enabled allowScrollInElement={topAllowedRef} />
    </>
  );
};

beforeEach(() => {
  resetScrollLockTestState();
  document.body.innerHTML = "";
});

describe("ScrollLock", () => {
  it('sets body.style.overflow to "hidden" when enabled is true', () => {
    render(<ScrollLock enabled />);

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body.style.overflow when enabled changes to false", () => {
    const { rerender } = render(<ScrollLock enabled />);

    rerender(<ScrollLock enabled={false} />);

    expect(document.body.style.overflow).toBe("");
  });

  it("keeps overflow hidden until all lock instances release", () => {
    const first = render(<ScrollLock enabled />);
    const second = render(<ScrollLock enabled />);

    expect(document.body.style.overflow).toBe("hidden");

    first.rerender(<ScrollLock enabled={false} />);
    expect(document.body.style.overflow).toBe("hidden");

    second.rerender(<ScrollLock enabled={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("attaches global listeners once for multiple locks and removes them after the last release", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const first = render(<ScrollLock enabled />);
    const second = render(<ScrollLock enabled />);
    const third = render(<ScrollLock enabled />);

    const countCalls = (spy: ReturnType<typeof vi.spyOn>, eventName: string) =>
      spy.mock.calls.filter(([name]) => name === eventName).length;

    expect(countCalls(addSpy, "wheel")).toBe(1);
    expect(countCalls(addSpy, "touchstart")).toBe(1);
    expect(countCalls(addSpy, "touchmove")).toBe(1);
    expect(countCalls(addSpy, "keydown")).toBe(1);
    expect(countCalls(removeSpy, "wheel")).toBe(0);
    expect(countCalls(removeSpy, "touchstart")).toBe(0);
    expect(countCalls(removeSpy, "touchmove")).toBe(0);
    expect(countCalls(removeSpy, "keydown")).toBe(0);

    first.rerender(<ScrollLock enabled={false} />);
    expect(countCalls(removeSpy, "wheel")).toBe(0);
    expect(countCalls(removeSpy, "touchstart")).toBe(0);
    expect(countCalls(removeSpy, "touchmove")).toBe(0);
    expect(countCalls(removeSpy, "keydown")).toBe(0);

    second.rerender(<ScrollLock enabled={false} />);
    expect(countCalls(removeSpy, "wheel")).toBe(0);
    expect(countCalls(removeSpy, "touchstart")).toBe(0);
    expect(countCalls(removeSpy, "touchmove")).toBe(0);
    expect(countCalls(removeSpy, "keydown")).toBe(0);

    third.rerender(<ScrollLock enabled={false} />);
    expect(countCalls(removeSpy, "wheel")).toBe(1);
    expect(countCalls(removeSpy, "touchstart")).toBe(1);
    expect(countCalls(removeSpy, "touchmove")).toBe(1);
    expect(countCalls(removeSpy, "keydown")).toBe(1);
  });

  it("allows wheel scrolling in the top-layer allowed container with multiple locks", () => {
    const { getByRole, getByTestId } = render(<DualScrollLockHarness />);
    const topScrollable = getByTestId("top-scrollable");
    const topAllowedChild = getByRole("button", { name: "Top allowed child" });

    defineScrollMetrics(topScrollable, { scrollTop: 10, scrollHeight: 600, clientHeight: 100 });

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 60 });
    topAllowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("keeps outside scrolling blocked with multiple locks and different allowed containers", () => {
    const { getByRole } = render(<DualScrollLockHarness />);
    const outside = getByRole("button", { name: "Outside child" });
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 60 });

    outside.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  describe("layout shift prevention", () => {
    it("keeps pre-existing body.style.paddingRight unchanged when there is no scrollbar", () => {
      document.body.style.paddingRight = "12px";
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024);
      const { rerender } = render(<ScrollLock enabled />);

      expect(document.body.style.paddingRight).toBe("12px");

      rerender(<ScrollLock enabled={false} />);

      expect(document.body.style.paddingRight).toBe("12px");
    });

    it("adds padding-right equal to the scrollbar width when a scrollbar is present", () => {
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1007);

      render(<ScrollLock enabled />);

      expect(document.body.style.paddingRight).toBe("17px");
    });

    it("restores padding-right to its original value when the lock is released", () => {
      document.body.style.paddingRight = "8px";
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1007);
      const { rerender } = render(<ScrollLock enabled />);

      expect(document.body.style.paddingRight).toBe("25px");

      rerender(<ScrollLock enabled={false} />);

      expect(document.body.style.paddingRight).toBe("8px");
    });

    it("keeps padding-right applied until all lock instances release", () => {
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1007);
      const first = render(<ScrollLock enabled />);
      const second = render(<ScrollLock enabled />);

      expect(document.body.style.paddingRight).toBe("17px");

      first.rerender(<ScrollLock enabled={false} />);
      expect(document.body.style.paddingRight).toBe("17px");

      second.rerender(<ScrollLock enabled={false} />);
      expect(document.body.style.paddingRight).toBe("");
    });
  });

  it("prevents wheel events outside the allowed element", () => {
    const { getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const outside = getByRole("button", { name: "Outside child" });
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });

    outside.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not attach scroll locks when enabled is false", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    try {
      render(<ScrollLock enabled={false} />);

      expect(addEventListenerSpy).not.toHaveBeenCalledWith("wheel", expect.any(Function), {
        passive: false,
        capture: true,
      });
      expect(addEventListenerSpy).not.toHaveBeenCalledWith("touchstart", expect.any(Function), {
        passive: true,
        capture: true,
      });
      expect(addEventListenerSpy).not.toHaveBeenCalledWith("touchmove", expect.any(Function), {
        passive: false,
        capture: true,
      });
      expect(addEventListenerSpy).not.toHaveBeenCalledWith("keydown", expect.any(Function), {
        capture: true,
      });

      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
      document.body.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(document.body.style.overflow).toBe("");
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it("prevents wheel events when no allowed scroll element is provided", () => {
    render(
      <>
        <button type="button">Outside child</button>
        <ScrollLock enabled />
      </>,
    );

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("allows wheel events inside a scrollable allowed element", () => {
    const { getByTestId, getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const scrollable = getByTestId("allowed-scrollable");
    const allowedChild = getByRole("button", { name: "Allowed child" });
    defineScrollMetrics(scrollable, { scrollTop: 10, scrollHeight: 500, clientHeight: 100 });

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    allowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("prevents wheel events at the bottom of a scrollable allowed element", () => {
    const { getByTestId, getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const scrollable = getByTestId("allowed-scrollable");
    const allowedChild = getByRole("button", { name: "Allowed child" });
    defineScrollMetrics(scrollable, { scrollTop: 400, scrollHeight: 400, clientHeight: 100 });

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    allowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("prevents wheel events at the top of a scrollable allowed element when scrolling upward", () => {
    const { getByTestId, getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const scrollable = getByTestId("allowed-scrollable");
    const allowedChild = getByRole("button", { name: "Allowed child" });
    defineScrollMetrics(scrollable, { scrollTop: 0, scrollHeight: 400, clientHeight: 100 });

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -80 });
    allowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("prevents wheel events inside a non-scrollable allowed element", () => {
    const { getByRole } = render(<ScrollLockHarness enabled includeAllowedElement scrollable={false} />);
    const allowedChild = getByRole("button", { name: "Allowed child" });

    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
    allowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("prevents touch scroll outside the allowed element", () => {
    const { getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const outside = getByRole("button", { name: "Outside child" });

    outside.dispatchEvent(createTouchEvent("touchstart", 100));
    const moveEvent = createTouchEvent("touchmove", 50);
    outside.dispatchEvent(moveEvent);

    expect(moveEvent.defaultPrevented).toBe(true);
  });

  it("allows touch scroll inside a scrollable allowed element", () => {
    const { getByTestId, getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const scrollable = getByTestId("allowed-scrollable");
    const allowedChild = getByRole("button", { name: "Allowed child" });
    defineScrollMetrics(scrollable, { scrollTop: 10, scrollHeight: 500, clientHeight: 100 });

    allowedChild.dispatchEvent(createTouchEvent("touchstart", 100));
    const moveEvent = createTouchEvent("touchmove", 50);
    allowedChild.dispatchEvent(moveEvent);

    expect(moveEvent.defaultPrevented).toBe(false);
  });

  it.each(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "])(
    'prevents keyboard scroll key "%s" outside the allowed element',
    (key) => {
      const { getByRole } = render(
        <ScrollLockHarness enabled includeAllowedElement scrollable />,
      );
      const outside = getByRole("button", { name: "Outside child" });
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      });

      outside.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    },
  );

  it("allows keyboard scroll keys inside the allowed element", () => {
    const { getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const allowedChild = getByRole("button", { name: "Allowed child" });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    });

    allowedChild.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("removes all event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ScrollLockHarness enabled includeAllowedElement scrollable />);

    unmount();

    expect(addSpy).toHaveBeenCalledWith("wheel", expect.any(Function), {
      passive: false,
      capture: true,
    });
    expect(addSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), {
      passive: true,
      capture: true,
    });
    expect(addSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      passive: false,
      capture: true,
    });
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function), { capture: true });
    // These assertions verify cleanup wiring, even though expect.any(Function) cannot prove identity equality.
    expect(removeSpy).toHaveBeenCalledWith("wheel", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function), { capture: true });
  });
});
