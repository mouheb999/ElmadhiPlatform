/**
 * Age → the birth date the macro engine takes.
 *
 * One helper, used by every path that builds targets, because there were three
 * spellings of this conversion and they were one edge case away from disagreeing:
 * the funnel used today's month and day, `actions/diet.ts` used the 1st of
 * January, `plan-builder.tsx` used a string template of its own. All three
 * happen to yield the same whole number of years today — but "happens to" is
 * not a guarantee, and if they ever diverge the funnel would promise one calorie
 * target and the paid plan would store another, which is the single failure this
 * architecture exists to prevent.
 *
 * Today's month and day, so `differenceInYears` returns exactly the age given.
 * Note this is NOT what is stored in `diet_profiles.birth_date` — that column
 * keeps its own approximation and is not read back by any calculation.
 */
export function birthDateForAge(age: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - Math.round(age), now.getMonth(), now.getDate());
}
