"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export function MagnetLines({
  rows = 5,
  columns = 8,
  lineColor = "rgba(167, 169, 255, 0.35)",
  lineWidth = 1,
  lineHeight = 22,
  className = "",
}) {
  const containerRef = useRef(null);
  const [pointer, setPointer] = useState({ x: -1000, y: -1000 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const updatePointer = (event) => {
      setPointer({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => window.removeEventListener("pointermove", updatePointer);
  }, [reduceMotion]);

  const cells = useMemo(
    () => Array.from({ length: rows * columns }, (_, index) => index),
    [rows, columns],
  );

  return (
    <div
      ref={containerRef}
      className={["magnet-lines", className].filter(Boolean).join(" ")}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {cells.map((index) => (
        <MagnetLine
          key={index}
          pointer={pointer}
          reduceMotion={reduceMotion}
          lineColor={lineColor}
          lineWidth={lineWidth}
          lineHeight={lineHeight}
        />
      ))}
    </div>
  );
}

function MagnetLine({
  pointer,
  reduceMotion,
  lineColor,
  lineWidth,
  lineHeight,
}) {
  const lineRef = useRef(null);
  const [rotation, setRotation] = useState(28);

  useEffect(() => {
    if (reduceMotion || !lineRef.current) return;

    const rect = lineRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle =
      (Math.atan2(pointer.y - centerY, pointer.x - centerX) * 180) / Math.PI;

    setRotation(angle + 90);
  }, [pointer, reduceMotion]);

  return (
    <span className="magnet-lines__cell">
      <motion.span
        ref={lineRef}
        className="magnet-lines__line"
        animate={{ rotate: reduceMotion ? 28 : rotation }}
        transition={{ type: "spring", damping: 24, stiffness: 250, mass: 0.45 }}
        style={{
          width: lineWidth,
          height: lineHeight,
          backgroundColor: lineColor,
        }}
      />
    </span>
  );
}
