/**
 * React's canary type definitions, for <ViewTransition>.
 *
 * The App Router runs on the React canary that Next bundles, which exports
 * ViewTransition at runtime; the stable @types/react does not declare it yet.
 * This pulls in the matching canary declarations without changing which
 * React the app actually runs.
 */
/// <reference types="react/canary" />
