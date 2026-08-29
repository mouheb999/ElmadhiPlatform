import type { StringKey } from "@/lib/i18n";

/**
 * The sample account behind the checkout preview.
 *
 * Kept apart from the screens because it is the part that has to stay honest:
 * these are the shapes the real tables hold, so the preview cannot drift into
 * showing a product we do not sell. Numbers are one plausible person's — a
 * 78 kg man on a cut, three sessions a week — not a best case.
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

export type SlotKey = "breakfast" | "lunch" | "dinner" | "snack";

export type PreviewMeal = {
  slot: SlotKey;
  label: StringKey;
  items: StringKey;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * The day's plan. Breakfast and lunch start logged, dinner and the snack do
 * not — so there is something left to do, and the ring has somewhere to move
 * when the reader does it.
 */
export const MEALS: PreviewMeal[] = [
  { slot: "breakfast", label: "tour.f_b", items: "tour.f_b_items", kcal: 520, protein: 32, carbs: 48, fat: 22 },
  { slot: "lunch", label: "tour.f_l", items: "tour.f_l_items", kcal: 780, protein: 64, carbs: 88, fat: 19 },
  { slot: "dinner", label: "tour.f_d", items: "tour.f_d_items", kcal: 640, protein: 46, carbs: 62, fat: 18 },
  { slot: "snack", label: "tour.f_s", items: "tour.f_s_items", kcal: 210, protein: 12, carbs: 14, fat: 11 },
];

export const INITIALLY_LOGGED: SlotKey[] = ["breakfast", "lunch"];

export const TARGETS = { kcal: 2150, protein: 154, carbs: 212, fat: 70 };

export type PreviewFood = {
  id: string;
  name: StringKey;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** What the food search offers. Ordinary things, in ordinary portions. */
export const FOODS: PreviewFood[] = [
  { id: "f1", name: "tour.fd_1", kcal: 156, protein: 13, carbs: 1, fat: 11 },
  { id: "f2", name: "tour.fd_2", kcal: 210, protein: 7, carbs: 42, fat: 2 },
  { id: "f3", name: "tour.fd_3", kcal: 130, protein: 29, carbs: 0, fat: 1 },
  { id: "f4", name: "tour.fd_4", kcal: 247, protein: 46, carbs: 0, fat: 6 },
  { id: "f5", name: "tour.fd_5", kcal: 195, protein: 4, carbs: 42, fat: 1 },
  { id: "f6", name: "tour.fd_6", kcal: 120, protein: 10, carbs: 12, fat: 3 },
  { id: "f7", name: "tour.fd_7", kcal: 174, protein: 6, carbs: 6, fat: 15 },
  { id: "f8", name: "tour.fd_8", kcal: 200, protein: 2, carbs: 53, fat: 0 },
];

/** What the camera "finds", and what it adds up to. */
export const AI_ITEMS: { name: StringKey; kcal: number; protein: number; carbs: number; fat: number }[] = [
  { name: "tour.ai_i1", kcal: 297, protein: 55, carbs: 0, fat: 7 },
  { name: "tour.ai_i2", kcal: 195, protein: 4, carbs: 42, fat: 1 },
  { name: "tour.ai_i3", kcal: 88, protein: 0, carbs: 0, fat: 10 },
];

export const QA_CARDS: { q: StringKey; a: StringKey }[] = [
  { q: "tour.qa_q1", a: "tour.qa_a1" },
  { q: "tour.qa_q2", a: "tour.qa_a2" },
  { q: "tour.qa_q3", a: "tour.qa_a3" },
];
