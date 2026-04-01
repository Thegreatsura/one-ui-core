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

  it("prevents wheel events outside the allowed element", () => {
    const { getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const outside = getByRole("button", { name: "Outside child" });
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });

    outside.dispatchEvent(event);

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

  it("prevents keyboard scroll keys outside the allowed element", () => {
    const { getByRole } = render(
      <ScrollLockHarness enabled includeAllowedElement scrollable />,
    );
    const outside = getByRole("button", { name: "Outside child" });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    });

    outside.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

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
    expect(removeSpy).toHaveBeenCalledWith("wheel", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function), { capture: true });
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function), { capture: true });
  });
});
