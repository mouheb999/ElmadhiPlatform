"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Subtle fade + rise entrance for dashboard sections. Children stay
 * server-rendered — this only wraps them in a motion container.
 *
 * The reduced-motion branch deliberately changes the transition and nothing else.
 * `useReducedMotion` reads null on the server and the real setting on the client,
 * so branching on the element itself (or on `initial`) makes the server and client
 * trees disagree and React throws a hydration mismatch. Transitions are applied
 * after mount and never appear in the SSR markup, so varying only that is safe:
 * a reduced-motion visitor lands on the final state with no movement.
 */
export function Reveal({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.35, delay, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}
