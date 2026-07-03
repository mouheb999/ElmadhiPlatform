/**
 * Layer 2 for the workout engine — matches a training profile to one of the
 * named split templates from personalization-engine.md §6 (sourced from
 * AbuzWorkoutSplits.pdf's split catalog). Small scoring lookup, not a nested
 * if/else tree — see personalization-engine.md §3 for why.
 */

export type TemplateCandidate = {
  id: string;
  name: string;
  split_type: string;
  days_per_week: number;
  goal: string;
  experience: string;
  equipment_required: string;
};

export type TrainingProfileLike = {
  days_per_week: number;
  goal: string;
  experience: string;
  equipment: string;
};

const EXPERIENCE_ORDER = ["beginner", "intermediate", "advanced"];

function experienceDistance(a: string, b: string): number {
  return Math.abs(EXPERIENCE_ORDER.indexOf(a) - EXPERIENCE_ORDER.indexOf(b));
}

export function scoreTemplate(template: TemplateCandidate, profile: TrainingProfileLike): number {
  let score = 0;
  score += template.days_per_week === profile.days_per_week ? 10 : -Math.abs(template.days_per_week - profile.days_per_week) * 2;
  score += template.goal === profile.goal ? 6 : 0;
  score += template.equipment_required === profile.equipment ? 5 : 0;
  score -= experienceDistance(template.experience, profile.experience) * 3;
  return score;
}

export function pickBestTemplate<T extends TemplateCandidate>(
  templates: T[],
  profile: TrainingProfileLike,
): T | null {
  if (templates.length === 0) return null;
  return [...templates].sort((a, b) => scoreTemplate(b, profile) - scoreTemplate(a, profile))[0];
}
