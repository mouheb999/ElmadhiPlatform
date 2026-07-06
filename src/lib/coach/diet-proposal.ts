import type { createClient } from "@/lib/supabase/server";
import {
  proposeDietAdaptation,
  type CurrentTargets,
  type DietProposal,
} from "@/lib/algorithms/diet-adaptation";

type Supa = Awaited<ReturnType<typeof createClient>>;

const COOLDOWN_DAYS = 7;

export type DietProposalContext = {
  proposal: DietProposal;
  dietProfileId: string;
  targets: CurrentTargets;
};

/**
 * Server-side proposal computation, shared by the review page (display) and
 * the apply action (which recomputes rather than trusting client numbers).
 * Returns null when no rule fires, data is thin, or the weekly cooldown is
 * still running.
 */
export async function computeDietProposal(
  supabase: Supa,
  userId: string,
): Promise<DietProposalContext | null> {
  const { data: dietProfile } = await supabase
    .from("diet_profiles")
    .select("id, goal")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!dietProfile?.goal) return null;

  // Cooldown: at most one diet adjustment per week.
  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const { data: recentAdaptation } = await supabase
    .from("plan_adaptations")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "diet")
    .gte("applied_at", cooldownStart.toISOString())
    .limit(1)
    .maybeSingle();
  if (recentAdaptation) return null;

  const { data: macros } = await supabase
    .from("macro_targets")
    .select("calories, protein_g, carbs_g, fat_g, bmr, tdee, fiber_g")
    .eq("diet_profile_id", dietProfile.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!macros) return null;

  const today = new Date().toISOString().slice(0, 10);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 13);
  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("checkin_date, weight_kg")
    .eq("user_id", userId)
    .gte("checkin_date", windowStart.toISOString().slice(0, 10))
    .not("weight_kg", "is", null);

  const targets: CurrentTargets = {
    calories: macros.calories,
    proteinG: macros.protein_g,
    carbsG: macros.carbs_g,
    fatG: macros.fat_g,
    bmr: macros.bmr,
    tdee: macros.tdee,
    fiberG: macros.fiber_g,
  };

  const proposal = proposeDietAdaptation(
    dietProfile.goal,
    targets,
    (checkins ?? []).map((c) => ({ date: c.checkin_date, weightKg: c.weight_kg! })),
    today,
  );
  if (!proposal) return null;

  return { proposal, dietProfileId: dietProfile.id, targets };
}
