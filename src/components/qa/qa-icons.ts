import { Utensils, Dumbbell, Footprints, Moon, Venus, Brain, Apple, Pill, CircleHelp } from "lucide-react";

/**
 * The content file names its icons (`fork_knife`, `brain_capsule`, …); the
 * categories that predate it are matched on slug instead. Anything unknown
 * falls back to a question mark rather than breaking the card.
 *
 * Exported as a map (rather than a `getIcon()` call) because a component read
 * out of a constant is stable across renders; one built by a function call is
 * a new component every render — see react-hooks/static-components.
 */
export const QA_ICONS: Record<string, typeof CircleHelp> = {
  // content-file icon keys
  fork_knife: Utensils,
  dumbbell: Dumbbell,
  running: Footprints,
  moon: Moon,
  cycle: Venus,
  brain_capsule: Brain,
  // category slugs
  nutrition: Apple,
  training: Dumbbell,
  running_walking: Footprints,
  recovery: Moon,
  women_cycle: Venus,
  supplements: Pill,
  // used when nothing matches
  fallback: CircleHelp,
};

/** First key that names an icon we have, so `QA_ICONS[…]` always resolves. */
export function qaIconKey(...keys: (string | null | undefined)[]): string {
  for (const key of keys) {
    if (key && key in QA_ICONS && key !== "fallback") return key;
  }
  return "fallback";
}

/** Category accent from the content set; the brand green when there is none. */
export const QA_DEFAULT_ACCENT = "#5DD62C";

/** Guard against a bad value reaching `style` — only #rgb / #rrggbb pass. */
export function qaAccent(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    if (value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  }
  return QA_DEFAULT_ACCENT;
}
