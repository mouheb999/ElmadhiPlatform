import { STRING_KEYS, t, type Locale, type StringKey } from "@/lib/i18n";

/** Survives navigation, so edit mode stays on while the admin walks the app. */
export const EDIT_MODE_FLAG = "hype.copyEdit.on";
export const EDIT_MODE_DRAFT = "hype.copyEdit.draft";

/** `"<locale>:<key>"` → replacement text. Empty string means "reset to default". */
export type CopyDraft = Record<string, string>;

export function readFlag(): boolean {
  try {
    return localStorage.getItem(EDIT_MODE_FLAG) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(EDIT_MODE_FLAG, "1");
    else localStorage.removeItem(EDIT_MODE_FLAG);
  } catch {
    /* private mode */
  }
}

export function readDraft(): CopyDraft {
  try {
    const raw = localStorage.getItem(EDIT_MODE_DRAFT);
    return raw ? (JSON.parse(raw) as CopyDraft) : {};
  } catch {
    return {};
  }
}

export function writeDraft(draft: CopyDraft): void {
  try {
    localStorage.setItem(EDIT_MODE_DRAFT, JSON.stringify(draft));
  } catch {
    /* private mode */
  }
}

/** Collapses the whitespace differences between JSX output and the raw string. */
function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Which catalogue key produced this on-screen text.
 *
 * Identifying a string by what it *says* is what makes click-to-edit possible
 * without threading a key attribute through ~1500 `t()` call sites. The
 * catalogue already ships to the browser, so the lookup is local and exact.
 *
 * Returns every match, because the same words can come from different keys —
 * "Send" is a button in three unrelated screens — and editing the wrong one
 * silently changes a page the admin was not looking at. The caller disambiguates
 * rather than guessing.
 *
 * Built per call against the live locale so it always reflects published
 * overrides; the catalogue is ~1500 entries, which is nothing next to a click.
 */
export function keysForText(locale: Locale, text: string): StringKey[] {
  const needle = normalise(text);
  if (!needle) return [];
  const hits: StringKey[] = [];
  for (const key of STRING_KEYS) {
    if (normalise(t(locale, key)) === needle) hits.push(key);
  }
  return hits;
}

/**
 * Walks up from whatever was clicked to the nearest element whose whole text is
 * a catalogue string.
 *
 * Deepest-first: clicking a button whose label is a string should edit the
 * label, not some ancestor card that happens to contain only that button. The
 * climb stops at a small depth so a click on non-editable content cannot
 * accidentally match a large container.
 */
export function findEditable(
  locale: Locale,
  start: Element | null,
): { element: Element; keys: StringKey[] } | null {
  let node: Element | null = start;
  for (let depth = 0; node && depth < 5; depth++) {
    const text = node.textContent ?? "";
    // Long blocks are almost never a single catalogue string, and scanning them
    // is wasted work on every click.
    if (text.length <= 2000) {
      const keys = keysForText(locale, text);
      if (keys.length > 0) return { element: node, keys };
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Repaints an edited string in place.
 *
 * Only the text node holding the old value is touched, never `textContent` on
 * the element, which would delete sibling icons — most buttons in this product
 * are an SVG plus a label.
 */
export function replaceTextInPlace(element: Element, before: string, after: string): void {
  const target = normalise(before);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (normalise(node.nodeValue ?? "") === target) {
      node.nodeValue = after;
      return;
    }
    node = walker.nextNode();
  }
  // Split across several text nodes (interpolation, <bdi>, line breaks): fall
  // back to the element, but only when it has no element children to lose.
  if (element.children.length === 0) element.textContent = after;
}
