"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Subtle fade + rise entrance for dashboard sections. Children stay
 * server-rendered — this only wraps them in a motion container.
 */
export function Reveal({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
