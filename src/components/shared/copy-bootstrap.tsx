"use client";

import { applyCopyOverrides } from "@/lib/i18n";

/**
 * Hands the published copy to the browser's copy of the i18n module.
 *
 * The server applies overrides before it renders anything; the client bundle
 * has its own module instance, and without this it would resolve every string
 * from the built-in defaults and disagree with the server's HTML on any string
 * an admin has edited — a hydration mismatch on potentially every screen.
 *
 * Applied during render rather than in an effect, and mounted as the first
 * child of <body>, because both matter: an effect runs after its siblings have
 * already rendered with the wrong text, and a later sibling would be rendered
 * before this one had run. Renders nothing.
 */
export function CopyBootstrap({ overrides }: { overrides: Record<string, string> }) {
  applyCopyOverrides(overrides);
  return null;
}
