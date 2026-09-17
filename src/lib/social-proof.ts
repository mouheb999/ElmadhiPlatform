/**
 * Proof — the part of the sales flow that is not ours to write.
 *
 * ## Testimonials
 *
 * `TESTIMONIALS` ships **empty**, and every component that renders it hides
 * itself when it is. That is deliberate and it is not a placeholder to be
 * filled in with plausible-sounding names before launch.
 *
 * A testimonial is a claim that a named person said a thing and got a result.
 * Inventing one to put on a page that takes money is fraud, in Tunisia as
 * everywhere else, and it is also bad business: this product sells to a small
 * market where people recognise each other's names and can check. One real
 * quote from one real customer outperforms five invented ones, because the
 * fifth invented one is the reason nobody believes the other four.
 *
 * So: fill this in from people who actually trained on the plan, with their
 * permission, in their words. Three is plenty to start. Until there are three,
 * the funnel argues with the product instead — which is what the walkable
 * preview on /checkout is for.
 *
 * ## What is here instead
 *
 * `PROOF_POINTS` are statements about what the app does. Every one of them is
 * checkable against the code, and the components that show them sit where a
 * testimonial carousel would. They are not social proof and do not pretend to
 * be; they are the mechanism, said plainly, which is the honest thing to lead
 * with before there are customers to quote.
 */

import type { Locale } from "@/lib/i18n";

export type Testimonial = {
  /** A stable id. Anything unique — the components key on it. */
  id: string;
  /** How they want to be credited. A first name is fine; a fake one is not. */
  name: string;
  /** Optional: "Tunis, 8 months in". Context makes a quote land. */
  context?: { en: string; tn: string };
  /** Their words, in the language they said them. Translate, do not embellish. */
  quote: { en: string; tn: string };
  /**
   * A result, only when it is true and they are happy to have it published:
   * "-7 kg in 4 months". Left out entirely rather than rounded up.
   */
  result?: { en: string; tn: string };
  /**
   * A photo in /public. Optional — a quote with a name and no face is more
   * credible than a quote with a stock face.
   */
  photo?: string;
};

/**
 * Real customers, or nothing.
 *
 * ```ts
 * export const TESTIMONIALS: Testimonial[] = [
 *   {
 *     id: "amine",
 *     name: "Amine",
 *     context: { en: "Sfax, 5 months in", tn: "صفاقس، 5 أشهر" },
 *     quote: {
 *       en: "First programme I actually finished. The weekly change is what did it.",
 *       tn: "أول برنامج كمّلتو. التبديل كل جمعة هو اللي خلاني نكمّل.",
 *     },
 *     result: { en: "-9 kg", tn: "-9 كغ" },
 *   },
 * ];
 * ```
 */
export const TESTIMONIALS: Testimonial[] = [];

export function hasTestimonials(): boolean {
  return TESTIMONIALS.length > 0;
}

export function testimonialText(locale: Locale, pair: { en: string; tn: string }): string {
  return locale === "tn" ? pair.tn : pair.en;
}

/**
 * What the product does, in five lines that are all true.
 *
 * Each one names a mechanism a reader can go and verify in the preview on
 * /checkout, which is the point: a claim you can immediately check is worth
 * more than a claim you have to take on faith, and this page has not earned
 * faith yet.
 */
export type ProofPoint = {
  id: string;
  /** Lucide icon name, resolved by the component that renders it. */
  icon: "dumbbell" | "utensils" | "sparkles" | "message" | "trending";
  title: { en: string; tn: string };
  body: { en: string; tn: string };
};

export const PROOF_POINTS: ProofPoint[] = [
  {
    id: "program",
    icon: "dumbbell",
    title: {
      en: "A program built from your answers",
      tn: "برنامج مبني على إجاباتك",
    },
    body: {
      en: "Your days, your equipment, your injuries. Every exercise has a video and a one-tap swap if it does not suit you.",
      tn: "أيامك، المعدات اللي عندك، الإصابات متاعك. كل تمرين عندو فيديو وتنجم تبدلو بضغطة وحدة.",
    },
  },
  {
    id: "food",
    icon: "utensils",
    title: {
      en: "Meals with real food, at your budget",
      tn: "ماكلة حقيقية، على قد جيبك",
    },
    body: {
      en: "Calories and macros worked out from your body, then filled with food you already eat and can afford.",
      tn: "السعرات والماكروز محسوبين من جسمك، ومعمرين بماكلة تاكل فيها وتنجم تشريها.",
    },
  },
  {
    id: "ai",
    icon: "sparkles",
    title: {
      en: "Photograph a plate, get the macros",
      tn: "صوّر الصحن، تجيك الماكروز",
    },
    body: {
      en: "No searching a database for couscous. Point the camera at dinner and it lands in your diary.",
      tn: "ما تلوجش في قاعدة بيانات على الكسكسي. صوّر العشاء وتتسجل توّا في اليومية متاعك.",
    },
  },
  {
    id: "adapt",
    icon: "trending",
    title: {
      en: "It changes when you stall",
      tn: "يتبدّل كي تحبس",
    },
    body: {
      en: "Weight and sessions are reviewed every week. When the scale stops moving, the numbers move instead of you guessing.",
      tn: "الوزن والحصص يتراجعو كل جمعة. كي الميزان يحبس، الأرقام تتبدّل بدل ما تخمّم وحدك.",
    },
  },
  {
    id: "coach",
    icon: "message",
    title: {
      en: "A real coach answers, in Derja",
      tn: "مدرب حقيقي يجاوبك، بالدارجة",
    },
    body: {
      en: "Not a chatbot. You ask, a person who writes the programs answers.",
      tn: "موش روبو. تسأل، والشخص اللي يكتب البرامج هو اللي يجاوبك.",
    },
  },
];
