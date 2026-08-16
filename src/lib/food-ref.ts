/**
 * One id space for two food tables.
 *
 * A plan item, a diary entry and a picker row can all name either a catalog
 * ingredient (`nutrition_ingredients`, TEXT slug) or one of the user's own
 * foods (`user_foods`, UUID). Every screen that lists food lists both, and
 * every action that takes "a food id" has to be able to receive both.
 *
 * The alternative was a second id parameter threaded through the picker, the
 * diary, the plan editor and six server actions, where the invariant "exactly
 * one of these is set" is re-stated at each stop and can be got wrong at any of
 * them. A prefixed string carries the same information in one value that cannot
 * be half-supplied.
 *
 * The prefix is not security. It is a client-supplied string like any other:
 * `resolveFood` re-reads whichever table it names, and a user food is fetched
 * scoped to the caller, so naming somebody else's food resolves to nothing.
 *
 * Client-safe: pure string handling, no imports.
 */

const USER_FOOD_PREFIX = "uf:";

export type FoodRef =
  | { kind: "catalog"; id: string }
  | { kind: "user"; id: string };

/** The single string the client passes around and posts back. */
export function encodeFoodRef(ref: FoodRef): string {
  return ref.kind === "user" ? `${USER_FOOD_PREFIX}${ref.id}` : ref.id;
}

/**
 * Read a ref back. Anything without the prefix is a catalog slug — catalog ids
 * are lowercase slugs (`chicken_breast`) and can never contain a colon, so the
 * two spaces cannot collide.
 */
export function parseFoodRef(value: string): FoodRef {
  return value.startsWith(USER_FOOD_PREFIX)
    ? { kind: "user", id: value.slice(USER_FOOD_PREFIX.length) }
    : { kind: "catalog", id: value };
}

/** True when this row is one of the user's own foods. For the "Mine" badge. */
export function isUserFoodRef(value: string): boolean {
  return value.startsWith(USER_FOOD_PREFIX);
}
