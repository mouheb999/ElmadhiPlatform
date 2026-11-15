import { describe, expect, it, vi } from "vitest";

// The module is server-only and reaches for the service role; neither matters
// to the one pure function under test.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { isRepeatTrial } from "./trial-device";

describe("one trial per device", () => {
  it("lets the first account on a device keep its trial", () => {
    expect(isRepeatTrial(undefined, "user-a")).toBe(false);
    expect(isRepeatTrial("", "user-a")).toBe(false);
  });

  it("closes the trial of a second account on the same device", () => {
    expect(isRepeatTrial("user-a", "user-b")).toBe(true);
  });

  it("does not punish the same account for passing through sign-up twice", () => {
    expect(isRepeatTrial("user-a", "user-a")).toBe(false);
  });
});
