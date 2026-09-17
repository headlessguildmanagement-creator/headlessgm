"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, useState } from "react";

function DockItem({
  item,
  mouseX,
  iconSize,
  maxScale,
  magneticDistance,
  reducedMotion,
}) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (value) => {
    if (!ref.current) return magneticDistance + 1;
    const rect = ref.current.getBoundingClientRect();
    return value - (rect.left + rect.width / 2);
  });

  const scale = useTransform(
    distance,
    [-magneticDistance, 0, magneticDistance],
    [1, maxScale, 1],
  );
  const smoothScale = useSpring(scale, {
    damping: 22,
    stiffness: 310,
    mass: 0.45,
  });
  const size = useTransform(smoothScale, (value) => value * iconSize);
  const lift = useTransform(smoothScale, (value) => (value - 1) * -9);
  const smoothLift = useSpring(lift, {
    damping: 22,
    stiffness: 310,
    mass: 0.45,
  });

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={item.label}
      onClick={item.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`magnetic-dock__item${item.isActive ? " is-active" : ""}`}
      style={{
        width: reducedMotion ? iconSize : size,
        height: reducedMotion ? iconSize : size,
        y: reducedMotion ? 0 : smoothLift,
      }}
      whileTap={reducedMotion ? undefined : { scale: 0.94 }}
    >
      <span className="magnetic-dock__icon">{item.icon}</span>
      <AnimatePresence>
        {hovered && (
          <motion.span
            className="magnetic-dock__label"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function MagneticDock({
  items,
  iconSize = 42,
  maxScale = 1.36,
  magneticDistance = 112,
  className = "",
}) {
  const mouseX = useMotionValue(Infinity);
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className={["magnetic-dock", className].filter(Boolean).join(" ")}
      onMouseMove={
        reducedMotion ? undefined : (event) => mouseX.set(event.clientX)
      }
      onMouseLeave={() => mouseX.set(Infinity)}
      initial={false}
    >
      {items.map((item) => (
        <DockItem
          key={item.id}
          item={item}
          mouseX={mouseX}
          iconSize={iconSize}
          maxScale={maxScale}
          magneticDistance={magneticDistance}
          reducedMotion={reducedMotion}
        />
      ))}
    </motion.div>
  );
}
