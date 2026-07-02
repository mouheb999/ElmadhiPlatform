/**
 * Plain (non-server) module for food enums + the input type.
 *
 * These live outside `foods.ts` because that file is `"use server"`, and a
 * server-action module may only export async functions — any exported constant
 * would be replaced by a server reference (breaking `.map` on the client).
 */

export const FOOD_CATEGORIES = [
  "grain",
  "protein",
  "dairy",
  "vegetable",
  "fruit",
  "fat",
  "prepared",
  "snack",
  "drink",
] as const;

export const PRICE_TIERS = ["low", "medium", "high"] as const;

export type FoodInput = {
  name_ar: string;
  name_en: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  typical_serving_g: number | null;
  price_tnd_per_kg: number | null;
  price_tier: string | null;
  allergens: string[];
  tags: string[];
  is_common: boolean;
  image_url: string | null;
};
