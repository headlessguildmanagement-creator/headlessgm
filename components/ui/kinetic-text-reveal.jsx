"use client";

import {
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

function splitIntoGraphemes(value) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }

  return Array.from(value);
}

function getSegments(text, splitBy) {
  let animatedIndex = 0;

  if (splitBy === "characters") {
    return splitIntoGraphemes(text).map((character) => {
      const animated = !/\s/.test(character);
      return {
        value: character,
        animated,
        index: animated ? animatedIndex++ : -1,
      };
    });
  }

  return text.split(/(\s+)/).map((part) => {
    const animated = !/^\s+$/.test(part) && part.length > 0;
    return {
      value: part,
      animated,
      index: animated ? animatedIndex++ : -1,
    };
  });
}

function getDelay(index, total, stagger, staggerFrom) {
  if (typeof staggerFrom === "number") {
    return Math.abs(staggerFrom - index) * stagger;
  }
  if (staggerFrom === "end") return (total - 1 - index) * stagger;
  if (staggerFrom === "center") {
    return Math.abs((total - 1) / 2 - index) * stagger;
  }
  if (staggerFrom === "edges") {
    return Math.min(index, total - 1 - index) * stagger;
  }
  return index * stagger;
}

function getOffset(direction, distance) {
  if (direction === "down") return { x: 0, y: -distance };
  if (direction === "left") return { x: distance, y: 0 };
  if (direction === "right") return { x: -distance, y: 0 };
  return { x: 0, y: distance };
}

export const KineticTextReveal = forwardRef(function KineticTextReveal(
  {
    text,
    className = "",
    segmentClassName = "",
    maskClassName = "",
    splitBy = "words",
    direction = "up",
    distance = 22,
    stagger = 0.07,
    staggerFrom = "start",
    transition = { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
    blur = true,
    autoPlay = true,
    delay = 0,
    onRevealStart,
    onRevealComplete,
    ...props
  },
  ref,
) {
  const shouldReduceMotion = useReducedMotion();
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);

  const segments = useMemo(() => getSegments(text, splitBy), [text, splitBy]);
  const animatedTotal = segments.filter((segment) => segment.animated).length;

  useImperativeHandle(ref, () => ({
    play: () => {
      setVisible(false);
      requestAnimationFrame(() => {
        setRun((current) => current + 1);
        setVisible(true);
        onRevealStart?.();
      });
    },
    reset: () => setVisible(false),
  }));

  useEffect(() => {
    if (!autoPlay) return;

    const timeout = window.setTimeout(() => {
      setRun((current) => current + 1);
      setVisible(true);
      onRevealStart?.();
    }, delay * 1000);

    return () => window.clearTimeout(timeout);
  }, [autoPlay, delay, text, onRevealStart]);

  const offset = getOffset(direction, distance);

  const variants = {
    hidden: shouldReduceMotion
      ? { opacity: 0 }
      : {
          opacity: 0,
          x: offset.x,
          y: offset.y,
          filter: blur ? "blur(6px)" : "blur(0px)",
        },
    visible: (index) => ({
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            ...transition,
            delay: getDelay(index, animatedTotal, stagger, staggerFrom),
          },
    }),
  };

  return (
    <span
      className={["kinetic-text", className].filter(Boolean).join(" ")}
      aria-label={text}
      {...props}
    >
      <span className="sr-only">{text}</span>
      {segments.map((segment, index) => {
        if (!segment.animated) {
          return (
            <span key={`${run}-${index}`} aria-hidden="true">
              {segment.value}
            </span>
          );
        }

        return (
          <span
            key={`${run}-${index}`}
            className={["kinetic-mask", maskClassName].filter(Boolean).join(" ")}
            aria-hidden="true"
          >
            <motion.span
              custom={segment.index}
              variants={variants}
              initial="hidden"
              animate={visible ? "visible" : "hidden"}
              className={["kinetic-segment", segmentClassName]
                .filter(Boolean)
                .join(" ")}
              onAnimationComplete={
                segment.index === animatedTotal - 1
                  ? onRevealComplete
                  : undefined
              }
            >
              {segment.value}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
});
