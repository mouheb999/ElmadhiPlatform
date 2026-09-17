import type { StringKey } from "@/lib/i18n";

/**
 * Sample data for the two preview screens this file's neighbours do not cover.
 *
 * Most of the checkout preview now renders the product's own components over
 * `preview-account.ts`, which holds its data in the real tables' shapes. What
 * is left here is what those two hand-built screens need — the workout session
 * and the camera — and it is kept separate for the same reason as before: it is
 * the part that has to stay honest, so it stays where it can be read in one go.
 *
 * Numbers are one plausible person's — a 78 kg man on a cut, three sessions a
 * week — not a best case.
 */

export type PreviewExercise = {
  id: string;
  name: StringKey;
  /** Prescribed sets × reps, exactly as `user_program_exercises` holds it. */
  sets: number;
  reps: string;
  /** Starting load, in kg. Prefilled from "last time", like the real screen. */
  weight: number;
  img: string;
};

export const PROGRAM: PreviewExercise[] = [
  { id: "e1", name: "tour.p_ex1", sets: 4, reps: "8", weight: 60, img: "/exercise-library/chest/barbell-bench-press.webp" },
  { id: "e2", name: "tour.p_ex2", sets: 3, reps: "10", weight: 22, img: "/exercise-library/chest/incline-dumbbell-press.webp" },
  { id: "e3", name: "tour.p_ex3", sets: 3, reps: "15", weight: 10, img: "/exercise-library/shoulders/lateral-raise.webp" },
  { id: "e4", name: "tour.p_ex4", sets: 3, reps: "12", weight: 25, img: "/exercise-library/triceps/triceps-pushdown.webp" },
  { id: "e5", name: "tour.p_ex5", sets: 3, reps: "12", weight: 15, img: "/exercise-library/chest/cable-crossover.webp" },
];

/** What the camera "finds", and what it adds up to. */
export const AI_ITEMS: { name: StringKey; kcal: number; protein: number; carbs: number; fat: number }[] = [
  { name: "tour.ai_i1", kcal: 297, protein: 55, carbs: 0, fat: 7 },
  { name: "tour.ai_i2", kcal: 195, protein: 4, carbs: 42, fat: 1 },
  { name: "tour.ai_i3", kcal: 88, protein: 0, carbs: 0, fat: 10 },
];
