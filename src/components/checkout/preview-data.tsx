import type { StringKey } from "@/lib/i18n";

/**
 * The program screen's exercise list.
 *
 * All that is left of this file. The session and the camera render the real
 * `SessionClient` and `CalorieAiClient` now, over `preview-account.ts`; the
 * program tab is the last screen still drawn at preview scale, and this is
 * what it draws.
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
