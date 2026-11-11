/**
 * The two one-time pointers shown inside the app, and how they are put away.
 *
 * A cookie rather than localStorage, so the server can see the answer: once
 * both are dismissed the layout renders nothing and asks the database nothing,
 * instead of shipping a component that wakes up only to learn it is not
 * wanted. Client-safe, zero deps.
 */
export const HINT_PROGRESS_COOKIE = "hype_hint_progress";
export const HINT_INSTALL_COOKIE = "hype_hint_install";

/** A year. Long enough that a dismissed pointer stays dismissed. */
export const HINT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
