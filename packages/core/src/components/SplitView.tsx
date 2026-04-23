"use client";

import React, { forwardRef, useState, useEffect, useRef, ReactNode } from "react";
import { Flex, Card, Column } from ".";
import styles from "./SplitView.module.scss";
import { ElementType } from "./ElementType";
import classNames from "classnames";

interface SplitViewProps extends React.ComponentProps<typeof Flex> {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  defaultSplit?: number;
  minSplit?: number;
  maxSplit?: number;
  direction?: "row" | "column";
  resizeHandleSize?: "xs" | "s" | "m" | "l";
  resizeHandleBackground?: "neutral-weak" | "brand-medium";
  className?: string;
  style?: React.CSSProperties;
}

const SplitView = forwardRef<HTMLDivElement, SplitViewProps>(
  (
    {
      leftPanel,
      rightPanel,
      defaultSplit = 0.3,
      minSplit = 0.1,
      maxSplit = 0.9,
      direction = "row",
      resizeHandleSize = "s",
      resizeHandleBackground = "neutral-weak",
      className,
      style,
      ...flexProps
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [splitRatio, setSplitRatio] = useState(defaultSplit);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        let newRatio: number;
        if (direction === "row") {
          newRatio = (e.clientX - rect.left) / rect.width;
        } else {
          newRatio = (e.clientY - rect.top) / rect.height;
        }
        
        setSplitRatio(Math.max(minSplit, Math.min(maxSplit, newRatio)));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = direction === "row" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
      }

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }, [isDragging, direction, minSplit, maxSplit]);

    const isHorizontal = direction === "row";
    const splitPercentage = `${splitRatio * 100}%`;
    const remainingPercentage = `${(1 - splitRatio) * 100}%`;

    const handleSizeMap = {
      xs: "4",
      s: "8", 
      m: "12",
      l: "16"
    };

    const handleSize = handleSizeMap[resizeHandleSize];

    return (
      <Flex
        ref={containerRef}
        direction={direction}
        fill
        className={classNames(styles.splitView, className)}
        style={style}
        {...flexProps}
      >
        {/* Left/Top Panel */}
        <Flex
          fill
          style={{
            [isHorizontal ? "width" : "height"]: splitPercentage,
            [isHorizontal ? "minWidth" : "minHeight"]: 0,
            overflow: "auto",
          }}
        >
          {leftPanel}
        </Flex>

        {/* Resize Handle */}
        <Flex
          fillHeight={isHorizontal}
          fillWidth={!isHorizontal}
          center
          className={classNames(styles.resizeHandle, {
            [styles.dragging]: isDragging,
          })}
          onMouseDown={() => setIsDragging(true)}
          style={{
            cursor: isHorizontal ? "col-resize" : "row-resize",
            userSelect: "none",
          }}
        >
          <Card
            fillWidth={isHorizontal}
            fillHeight={!isHorizontal}
            background={isDragging ? "brand-medium" : resizeHandleBackground}
            border="neutral-alpha-weak"
            radius="full"
            style={{
              [isHorizontal ? "height" : "width"]: handleSize,
              [isHorizontal ? "width" : "height"]: "100%",
              transition: "background 0.2s ease",
            }}
          />
        </Flex>

        {/* Right/Bottom Panel */}
        <Flex
          fill
          style={{
            [isHorizontal ? "width" : "height"]: remainingPercentage,
            [isHorizontal ? "minWidth" : "minHeight"]: 0,
            overflow: "auto",
          }}
        >
          {rightPanel}
        </Flex>
      </Flex>
    );
  }
);

SplitView.displayName = "SplitView";

export { SplitView };
export type { SplitViewProps };
