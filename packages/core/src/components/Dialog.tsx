"use client";

import React, {
  ReactNode,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useState,
  useContext,
  useId,
  useLayoutEffect,
} from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import { Column, Flex, Heading, IconButton, ScrollLock, Text } from ".";
import {
  DialogContext,
  VisibleDialogLayer,
  removeVisibleDialogLayer,
  upsertVisibleDialogLayer,
} from "../internal/dialogState";
import styles from "./Dialog.module.scss";

interface DialogProps extends Omit<React.ComponentProps<typeof Flex>, "title"> {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode | string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  base?: boolean;
  stack?: boolean;
  onHeightChange?: (height: number) => void;
  minHeight?: number;
}

export const DialogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <DialogContext.Provider
      value={{
        upsertVisibleDialog: upsertVisibleDialogLayer,
        removeVisibleDialog: removeVisibleDialogLayer,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
};

const Dialog: React.FC<DialogProps> = forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      isOpen,
      onClose,
      title,
      description,
      children,
      stack,
      base,
      footer,
      onHeightChange,
      minHeight,
      ...rest
    },
    ref,
  ) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const wasVisibleRef = useRef(isOpen);
    const focusRestoredRef = useRef(false);
    const dialogId = useId();
    const dialogTitleId = `${dialogId}-title`;
    const [isVisible, setIsVisible] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const { upsertVisibleDialog, removeVisibleDialog } = useContext(DialogContext);

    const getPortalContainer = useCallback((): HTMLElement | null => {
      let portalContainer: HTMLElement | null = dialogRef.current;
      while (portalContainer && portalContainer.parentElement !== document.body) {
        portalContainer = portalContainer.parentElement;
      }
      return portalContainer;
    }, []);

    useEffect(() => {
      if (dialogRef.current && isVisible) {
        const height = dialogRef.current.offsetHeight;
        onHeightChange?.(height);
      }
    }, [isVisible, onHeightChange]);

    useLayoutEffect(() => {
      if (!isVisible || !dialogRef.current) {
        removeVisibleDialog(dialogId);
        return;
      }

      const portalContainer = getPortalContainer();
      if (!portalContainer) return;

      upsertVisibleDialog({
        id: dialogId,
        dialogElement: dialogRef.current,
        portalContainer,
      });
    }, [dialogId, getPortalContainer, isVisible, removeVisibleDialog, upsertVisibleDialog]);

    useEffect(() => {
      return () => {
        removeVisibleDialog(dialogId);
      };
    }, [dialogId, removeVisibleDialog]);

    useEffect(() => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }

      if (isOpen) {
        setIsVisible(true);
        animationTimerRef.current = setTimeout(() => {
          setIsAnimating(true);
          animationTimerRef.current = null;
        }, 0);
      } else {
        setIsAnimating(false);
        animationTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          animationTimerRef.current = null;
        }, 300);
      }

      return () => {
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
          animationTimerRef.current = null;
        }
      };
    }, [isOpen]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent) => {
        if (event.key === "Escape" && !base) {
          onClose();
        }
        if (event.key === "Tab" && dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );

          if (focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (event.shiftKey && document.activeElement === firstElement) {
              event.preventDefault();
              lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
              event.preventDefault();
              firstElement.focus();
            }
          }
        }
      },
      [onClose, base],
    );

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("keydown", handleKeyDown);
        };
      }
    }, [isOpen, handleKeyDown]);

    useEffect(() => {
      if (isOpen && dialogRef.current) {
        focusRestoredRef.current = false;
        previouslyFocusedElementRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0];
        firstElement?.focus();
      }
    }, [isOpen]);

    const restoreFocus = useCallback(() => {
      if (focusRestoredRef.current) return;

      const previousElement = previouslyFocusedElementRef.current;
      if (previousElement && document.contains(previousElement)) {
        previousElement.focus();
      }

      focusRestoredRef.current = true;
    }, []);

    useEffect(() => {
      if (wasVisibleRef.current && !isVisible) {
        restoreFocus();
      }

      wasVisibleRef.current = isVisible;
    }, [isVisible, restoreFocus]);

    useEffect(() => {
      return () => {
        restoreFocus();
      };
    }, [restoreFocus]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (event.button !== 0) return;

        const isInsideDropdownPortal =
          (event.target as Element)?.closest(".dropdown-portal") !== null;

        if (isInsideDropdownPortal) {
          return;
        }

        if (!dialogRef.current?.contains(event.target as Node)) {
          if (stack || !base) {
            event.preventDefault();
            onClose();
          }
        }
      };

      if (isVisible) {
        const timeoutId = setTimeout(() => {
          document.addEventListener("mousedown", handleClickOutside, { capture: true });
        }, 10);

        return () => {
          clearTimeout(timeoutId);
          document.removeEventListener("mousedown", handleClickOutside, { capture: true });
        };
      }
    }, [isVisible, onClose, stack, base]);

    if (!isVisible) return null;

    return ReactDOM.createPortal(
      <>
        <ScrollLock enabled={isOpen} allowScrollInElement={dialogRef} />
        <Flex
        ref={ref}
        transition="macro-medium"
        background="overlay"
        position="fixed"
        zIndex={base ? 8 : 9}
        top="0"
        left="0"
        right="0"
        bottom="0"
        className={classNames(styles.overlay, {
          [styles.open]: isAnimating,
        })}
        center
        padding="l"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <Flex
          fill
          center
          transition="macro-medium"
          style={{
            transform: base ? "scale(0.94) translateY(-1.25rem)" : "",
          }}
        >
          <Column
            position="unset"
            className={classNames(styles.dialog, {
              [styles.open]: isAnimating,
            })}
            style={{
              minHeight: minHeight ? `${minHeight}px` : undefined,
            }}
            ref={dialogRef}
            fillWidth
            transition="macro-medium"
            shadow="xl"
            radius="xl"
            border="neutral-medium"
            background="neutral-weak"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const focusableElements = Array.from(
                  dialogRef.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                  ) || [],
                );

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                if (e.shiftKey && document.activeElement === firstElement) {
                  e.preventDefault();
                  lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                  e.preventDefault();
                  firstElement.focus();
                }
              }
            }}
            {...rest}
          >
            <Column
              as="header"
              paddingX="24"
              paddingTop="24"
              paddingBottom="s"
              gap="4"
            >
              <Flex fillWidth horizontal="between" gap="8">
                {typeof title === "string" ? (
                  <Heading id={dialogTitleId} variant="heading-strong-l">
                    {title}
                  </Heading>
                ) : (
                  <div id={dialogTitleId}>{title}</div>
                )}
                <IconButton
                  icon="close"
                  size="m"
                  variant="tertiary"
                  tooltip="Close"
                  onClick={onClose}
                />
              </Flex>
              {description && (
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {description}
                </Text>
              )}
            </Column>
            <Column
              as="section"
              paddingX="24"
              paddingBottom="24"
              flex={1}
              overflowY="auto"
            >
              {children}
            </Column>
            {footer && (
              <Flex borderTop="neutral-medium" as="footer" horizontal="end" padding="12" gap="8">
                {footer}
              </Flex>
            )}
          </Column>
        </Flex>
      </Flex>
      </>,
      document.body,
    );
  },
);

Dialog.displayName = "Dialog";

export { Dialog };
