import { describe, expect, it } from "vitest";
import {
  contactEmail,
  formatPhone,
  isPhoneLoginEmail,
  isValidPhone,
  normalizePhone,
  parseLoginIdentifier,
  phoneLoginEmail,
  whatsappLink,
} from "./phone";

describe("normalizePhone", () => {
  it("accepts the shapes people actually type", () => {
    for (const input of [
      "26341616",
      "26 341 616",
      "026341616",
      "+216 26 341 616",
      "0021626341616",
      "21626341616",
      "+21626341616",
    ]) {
      expect(normalizePhone(input)).toBe("+21626341616");
    }
  });

  it("keeps foreign numbers on their own country code", () => {
    // A real one from the waitlist — an Italian number must not become +216.
    expect(normalizePhone("+393931327449")).toBe("+393931327449");
    expect(normalizePhone("00393931327449")).toBe("+393931327449");
  });

  it("rejects Tunisian landlines, which cannot receive WhatsApp", () => {
    expect(normalizePhone("71234567")).toBeNull();
  });

  it("rejects a bare long number with no country code to prove it", () => {
    expect(normalizePhone("393931327449")).toBeNull();
  });

  it("rejects junk, empties and wrong lengths", () => {
    for (const input of ["", "   ", null, undefined, "abc", "1234", "2634161"]) {
      expect(normalizePhone(input)).toBeNull();
    }
  });

  it("never returns a value the database CHECK would reject", () => {
    const constraint = /^\+[1-9][0-9]{7,14}$/;
    for (const input of ["26341616", "+393931327449", "+216 26 341 616"]) {
      const out = normalizePhone(input);
      expect(out).not.toBeNull();
      expect(out!).toMatch(constraint);
    }
  });
});

describe("whatsappLink", () => {
  it("strips the +, which wa.me rejects", () => {
    expect(whatsappLink("+21626341616")).toBe("https://wa.me/21626341616");
    expect(whatsappLink("26341616")).toBe("https://wa.me/21626341616");
  });

  it("encodes the pre-typed message", () => {
    const link = whatsappLink("26341616", "Ahla & welcome");
    expect(link).toBe("https://wa.me/21626341616?text=Ahla%20%26%20welcome");
  });

  it("returns null when there is no usable number, so no dead links", () => {
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("71234567")).toBeNull();
  });
});

describe("isValidPhone / formatPhone", () => {
  it("agrees with normalizePhone", () => {
    expect(isValidPhone("26341616")).toBe(true);
    expect(isValidPhone("71234567")).toBe(false);
  });

  it("spaces Tunisian numbers and leaves others alone", () => {
    expect(formatPhone("+21626341616")).toBe("+216 26 341 616");
    expect(formatPhone("+393931327449")).toBe("+393931327449");
    expect(formatPhone(null)).toBe("");
  });
});

describe("phone-only accounts", () => {
  it("files a number under a derived address, whatever shape it was typed in", () => {
    expect(phoneLoginEmail("26 341 616")).toBe("21626341616@phone.hypefitness.club");
    expect(phoneLoginEmail("+216 26 341 616")).toBe("21626341616@phone.hypefitness.club");
    expect(phoneLoginEmail("0021626341616")).toBe("21626341616@phone.hypefitness.club");
    expect(phoneLoginEmail("+33 6 12 34 56 78")).toBe("33612345678@phone.hypefitness.club");
    expect(phoneLoginEmail("123")).toBeNull();
    expect(phoneLoginEmail(null)).toBeNull();
  });

  it("never passes a derived address off as the customer's email", () => {
    expect(isPhoneLoginEmail("21626341616@phone.hypefitness.club")).toBe(true);
    expect(isPhoneLoginEmail("Someone@Phone.HypeFitness.club ")).toBe(true);
    expect(isPhoneLoginEmail("someone@gmail.com")).toBe(false);
    expect(contactEmail("21626341616@phone.hypefitness.club")).toBeNull();
    expect(contactEmail("someone@gmail.com")).toBe("someone@gmail.com");
    expect(contactEmail(null)).toBeNull();
  });

  it("reads the one sign-in field as an email or a number", () => {
    expect(parseLoginIdentifier(" Someone@Gmail.com ")).toEqual({
      kind: "email",
      email: "someone@gmail.com",
    });
    expect(parseLoginIdentifier("26341616")).toEqual({ kind: "phone", phone: "+21626341616" });
    expect(parseLoginIdentifier("026 341 616")).toEqual({ kind: "phone", phone: "+21626341616" });
    expect(parseLoginIdentifier("hello")).toBeNull();
    expect(parseLoginIdentifier("   ")).toBeNull();
  });
});
