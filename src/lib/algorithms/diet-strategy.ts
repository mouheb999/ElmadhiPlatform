/**
 * Layer 2 of the personalization engine (personalization-engine.md §3, §5):
 * the calorie-strategy lookup table. Sourced from AbuzDietPlan.pdf — every
 * number and tradeoff here is transcribed from that handbook, not invented.
 *
 * This is a small enumerable table, not a nested if/else tree: given a goal
 * and an intensity, there is exactly one strategy. Layer 1 (hard filters:
 * allergies, budget, dietary restriction) and Layer 3 (favorite-food scoring)
 * live in meal-plan-gen.ts and operate on the food catalog, not here.
 */

export type Goal = "lose_fat" | "maintain" | "build_muscle" | "recomp";
export type DietIntensity = "normal" | "aggressive" | "clean" | "dirty";

export type Bilingual = { en: string; ar: string };

export type DietStrategy = {
  key: string;
  /** kcal delta from TDEE. Dirty bulk has no real ceiling; see comment below. */
  calorieAdjustment: number;
  /** Rule D1: aggressive/dirty are opt-in only, never the default choice. */
  isDefault: boolean;
  requiresWarning: boolean;
  label: Bilingual;
  rationale: Bilingual;
  warning?: Bilingual;
};

const RECOMP: DietStrategy = {
  key: "recomp",
  calorieAdjustment: -150,
  isDefault: true,
  requiresWarning: false,
  label: { en: "Body recomposition", ar: "إعادة تشكيل الجسم (ريكومب)" },
  rationale: {
    en: "You stay near your current weight while fat drops and muscle grows. Best if you're already at an okay weight and want to look leaner without a full cut or bulk.",
    ar: "توزن يبقى قريب من وزنك الحالي، والدهون تنقص والعضل يزيد. أحسن خيار إذا وزنك مناسب وتحب تتنشف شوية بلا ما تعمل تنشيف أو تضخيم كامل.",
  },
};

const CUT_NORMAL: DietStrategy = {
  key: "cut_normal",
  calorieAdjustment: -500,
  isDefault: true,
  requiresWarning: false,
  label: { en: "Steady fat loss", ar: "تنشيف عادي" },
  rationale: {
    en: "A moderate 500 kcal deficit is easier to stick to, keeps your training energy up, and protects your muscle better than a fast cut. This is the right pace for almost everyone.",
    ar: "نقص 500 سعرة نهاري أسهل تكمل بيه، يخليك عندك طاقة في التمرين، ويحافظ على العضل أكثر من التنشيف السريع. هذا الإيقاع المناسب لأغلب الناس.",
  },
};

const CUT_AGGRESSIVE: DietStrategy = {
  key: "cut_aggressive",
  calorieAdjustment: -1000,
  isDefault: false,
  requiresWarning: true,
  label: { en: "Fast fat loss", ar: "تنشيف سريع" },
  rationale: {
    en: "A 1000 kcal deficit gets you there faster if you have a short deadline or a lot of fat to lose at the start.",
    ar: "نقص 1000 سعرة نهاري يوصلك أسرع إذا عندك وقت قصير أو نسبة دهون عالية في البداية.",
  },
  warning: {
    en: "Faster, but harder: less energy for training, higher risk of losing muscle, and not meant to last more than ~2 months. Switch to Steady fat loss once you're through the toughest part.",
    ar: "أسرع، لكن أصعب: طاقة أقل للتمرين، احتمال تخسر عضل أكثر، وما ينفعش تكمل فيه أكثر من شهرين تقريبًا. رجع للتنشيف العادي بعد ما تعدي أصعب مرحلة.",
  },
};

const BULK_CLEAN: DietStrategy = {
  key: "bulk_clean",
  calorieAdjustment: 300,
  isDefault: true,
  requiresWarning: false,
  label: { en: "Lean muscle gain", ar: "تضخيم نظيف" },
  rationale: {
    en: "A 300 kcal surplus puts most of the extra energy toward muscle, not fat, so you stay athletic-looking and need a shorter cut afterward. If your weight stalls for 2 weeks, we'll add 200 more.",
    ar: "فائض 300 سعرة يخلي أغلب الطاقة الزايدة تروح للعضل موش للدهون، تبقى شكلك رياضي وتحتاج تنشيف أقصر بعدها. إذا وزنك ثبت جمعتين، نزيدو 200 سعرة زيادة.",
  },
};

const BULK_DIRTY: DietStrategy = {
  key: "bulk_dirty",
  // The source material deliberately gives no ceiling ("eat everything in
  // front of you"). We still need a concrete number to seed a meal plan, so
  // this is a generous starting surplus the user can freely exceed — not a
  // cap. The UI copy must say so; don't present this number as a limit.
  calorieAdjustment: 700,
  isDefault: false,
  requiresWarning: true,
  label: { en: "Maximum muscle gain", ar: "تضخيم عشوائي" },
  rationale: {
    en: "Eating without counting maximizes how much muscle you can build in one hard bulk phase — this is just a starting point, not a ceiling.",
    ar: "الأكل بلا حساب يخلي أقصى عضل ممكن تبنيه في فترة تضخيم وحدة قوية — هذا رقم بداية موش سقف.",
  },
  warning: {
    en: "You'll gain noticeably more fat than with a clean bulk, and the cut afterward will be longer and harder. Best for people who are already lean and doing one deliberate hard bulk — not a everyday habit.",
    ar: "باش تزيد دهون أكثر بالمقارنة بالتضخيم النظيف، والتنشيف بعدها يكون أطول وأصعب. أحسن حاجة للي عندهم دهون قليلة أصلاً وباش يعملو تضخيم قوي مرة وحدة — موش عادة كل عام.",
  },
};

/** Rule D2: ambiguous "tone up" goals route to recomp, not a guessed cut/bulk. */
const STRATEGIES_BY_GOAL: Record<Goal, DietStrategy[]> = {
  recomp: [RECOMP],
  maintain: [RECOMP],
  lose_fat: [CUT_NORMAL, CUT_AGGRESSIVE],
  build_muscle: [BULK_CLEAN, BULK_DIRTY],
};

export function availableStrategies(goal: Goal): DietStrategy[] {
  return STRATEGIES_BY_GOAL[goal];
}

export function defaultStrategy(goal: Goal): DietStrategy {
  return STRATEGIES_BY_GOAL[goal].find((s) => s.isDefault) ?? STRATEGIES_BY_GOAL[goal][0];
}

/**
 * Resolves the strategy for a goal + requested intensity. Falls back to the
 * default (never the opt-in aggressive/dirty option) if the requested
 * intensity doesn't apply to this goal — e.g. asking for "aggressive" on a
 * recomp goal, which has no intensity variants.
 */
export function resolveDietStrategy(goal: Goal, intensity: DietIntensity): DietStrategy {
  const options = STRATEGIES_BY_GOAL[goal];
  const match = options.find((s) => s.key.endsWith(intensity) || (intensity === "normal" && s.isDefault));
  return match ?? defaultStrategy(goal);
}
