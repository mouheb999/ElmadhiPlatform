/**
 * What the delete-account confirm button sends to `deleteMyAccount`.
 *
 * In a plain module rather than the action file because a `"use server"`
 * module may only export async functions, and the client button needs it too.
 */
export const DELETE_CONFIRMATION = "delete-my-account";

/** Why `deleteMyAccount` refused; the screen shows each in the reader's language. */
export type DeleteAccountError = "failed" | "signed_out" | "admin";
