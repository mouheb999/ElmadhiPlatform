/**
 * Plain (non-server) module for exercise enums + the input type.
 *
 * These live outside `exercises.ts` because that file is `"use server"`, and a
 * server-action module may only export async functions — any exported constant
 * would be replaced by a server reference (breaking `.map` on the client).
 */

export const PRIMARY_MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "biceps",
  "triceps",
  "core",
  "forearms",
] as const;

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "band",
] as const;

export const MOVEMENT_PATTERNS = [
  "push",
  "pull",
  "hinge",
  "squat",
  "rotation",
  "carry",
] as const;

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export type ExerciseInput = {
  name_ar: string;
  name_en: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  movement_pattern: string | null;
  difficulty: string | null;
  contraindicated_for: string[];
  video_url: string | null;
  thumbnail_url: string | null;
  instructions: string | null;
};
