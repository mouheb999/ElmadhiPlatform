import { describe, expect, it } from "vitest";
import { calculateFitnessPlan } from "@/lib/funnel/fitness-plan";
import { referenceWeightKg, MIN_ADULT_AGE } from "@/lib/algorithms/energy";
import { POLICY } from "@/lib/algorithms/macro-allocation";

/**
 * The pre-deployment property sweep, kept.
 *
 * Adults only, every goal, every activity level, every training frequency and
 * four target-weight relationships (well below, just below, equal, above) across
 * the full height and weight domain. Roughly 600,000 combinations.
 *
 * Two of the assertions below exist because a HUMAN reading the output caught
 * what the earlier assertions did not: the calorie floor could lift a fat-loss
 * target above maintenance, so the plan said "fat loss" over a projection that
 * gained weight. Automated coverage is not the same as looking.
 */
describe("engine property sweep", () => {
  it("holds every invariant across the adult input domain", { timeout: 120_000 }, () => {
    // ---------------- property sweep, adults only ----------------
    const fails: string[] = [];
    let n = 0, valid = 0, constrained = 0, professional = 0, invalid = 0;
    void n; void constrained; void professional; void invalid;
    let worstDrift = 0;
    const st = { minC: 1e9, maxP: 0, maxF: 0, minCal: 1e9, maxCal: 0, minPkg: 9, minFkg: 9 };

    for (const gender of ["male", "female"] as const)
    for (const age of [18, 22, 30, 45, 60, 75, 90])
    for (const heightCm of [120, 140, 155, 165, 175, 185, 195, 210, 230])
    for (const weightKg of [35, 45, 55, 65, 75, 88, 100, 115, 135, 165, 200, 250])
    for (const activityLevel of ["sedentary", "light", "moderate", "active", "very_active"] as const)
    for (const goal of ["lose_fat", "build_muscle", "recomp", "maintain"] as const)
    for (const trainingDays of ["0", "1_2", "3_4", "5_6", "7"])
    for (const targetDelta of [-15, -0.5, 0, 12]) {
      n++;
      const plan = calculateFitnessPlan({
        goal, gender, age, heightCm, weightKg,
        targetWeightKg: Math.max(35, Math.min(250, weightKg + targetDelta)),
        activityLevel, trainingDays,
      });
      const id = `${gender}/${age}y/${heightCm}/${weightKg}/${activityLevel}/${goal}/td${trainingDays}/tgt${targetDelta}`;

      if (!plan.valid) {
        invalid++;
        // M. NO invalid plan may carry a prescription — not a minor, not a
        // missing-input visitor, not an impossible body. A refused plan that
        // still holds 2,225 kcal has invented a person.
        const z = plan.targets;
        if (z.calories !== 0 || z.proteinG !== 0 || z.carbsG !== 0 || z.fatG !== 0 || z.bmr !== 0 || z.tdee !== 0) {
          fails.push(`M invalid plan carries a prescription (${plan.invalidReason}) ${id}`);
        }
        continue;
      }
      valid++;
      if (plan.state === "constrained") constrained++;
      if (plan.state === "professional_assessment") professional++;

      const t = plan.targets;
      const ref = referenceWeightKg(weightKg, heightCm);
      const sum = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
      const drift = sum - t.calories;
      if (Math.abs(drift) > Math.abs(worstDrift)) worstDrift = drift;
      st.minC = Math.min(st.minC, t.carbsG); st.maxP = Math.max(st.maxP, t.proteinG);
      st.maxF = Math.max(st.maxF, t.fatG); st.minCal = Math.min(st.minCal, t.calories);
      st.maxCal = Math.max(st.maxCal, t.calories);
      st.minPkg = Math.min(st.minPkg, t.proteinG / ref); st.minFkg = Math.min(st.minFkg, t.fatG / ref);

      // 1. no adult calculator for minors (none should be valid at all)
      if (age < MIN_ADULT_AGE) fails.push(`1 minor produced a valid plan ${id}`);
      // 2. low-calorie safety
      if (t.calories < (gender === "male" ? 1600 : 1400)) fails.push(`2 calories ${t.calories} ${id}`);
      // 4. macro invariants AFTER rounding
      if (Math.abs(drift) > POLICY.driftToleranceKcal) fails.push(`4 drift ${drift} ${id}`);
      if (t.proteinG + 1 < POLICY.protein.minPerKg * ref) fails.push(`4 protein<min ${id}`);
      if (t.proteinG - 1 > POLICY.protein.maxPerKg * ref) fails.push(`4 protein>max/kg ${id}`);
      if (t.proteinG > POLICY.protein.maxG) fails.push(`4 protein>maxG ${id}`);
      if (t.fatG + 1 < POLICY.fat.minPerKg * ref) fails.push(`4 fat<min ${id}`);
      if (t.fatG - 1 > POLICY.fat.maxPerKg * ref) fails.push(`4 fat>max ${id}`);
      if (t.carbsG <= 0) fails.push(`4 carbs<=0 ${id}`);
      if (plan.state === "normal" && t.carbsG < POLICY.carbs.minG) fails.push(`4 carbs<floor ${id}`);
      if ((t.proteinG * 4) / t.calories > POLICY.protein.maxKcalShare + 0.01) fails.push(`4 protein share ${id}`);
      // 5. the allocator never altered the calorie target
      if (t.calories !== t.energy.calories) fails.push(`5 calorie target altered ${id}`);
      // L. finite, non-negative
      for (const v of [t.bmr, t.tdee, t.calories, t.proteinG, t.carbsG, t.fatG, plan.weeklyRateKg]) {
        if (!Number.isFinite(v)) fails.push(`L non-finite ${id}`);
      }
      if (t.calories < 0 || t.proteinG < 0 || t.carbsG < 0 || t.fatG < 0) fails.push(`L negative ${id}`);
      // dates unique AND chronological
      const times = plan.timeline.map((x) => x.date.getTime());
      if (new Set(times).size !== 4) fails.push(`dates not unique ${id}`);
      if (times.some((x, i) => i > 0 && x <= times[i - 1])) fails.push(`dates not chronological ${id}`);
      // THE GOAL AND THE PLAN MUST POINT THE SAME WAY.
      // Found by human review, not by the earlier assertions: the calorie floor
      // could lift a fat-loss target above maintenance, so the plan said "fat
      // loss" and the projection gained 0.36 kg a week.
      if (goal === "lose_fat" || goal === "recomp") {
        if (t.calories > t.tdee) fails.push(`GOAL deficit goal above maintenance ${id}`);
        if (plan.kind === "scale" && plan.weeklyRateKg > 0) fails.push(`GOAL loss goal gaining ${id}`);
      }
      if (goal === "maintain" && t.calories !== t.tdee) fails.push(`GOAL maintain off maintenance ${id}`);
      if (goal === "build_muscle" && t.calories < t.tdee) fails.push(`GOAL gain below maintenance ${id}`);
      // projection matches the calorie calculation
      const implied = ((t.calories - t.tdee) * 7) / 7700;
      if (plan.kind === "scale" && Math.abs(plan.weeklyRateKg - implied) > 1e-6) {
        fails.push(`projection/calorie mismatch ${id}`);
      }
    }


    expect(fails.slice(0, 20)).toEqual([]);
    expect(valid).toBeGreaterThan(100_000);
    expect(worstDrift).toBeLessThanOrEqual(POLICY.driftToleranceKcal);
  });
});
