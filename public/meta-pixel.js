/*
 * Meta's pixel bootstrap, as a file on our own origin rather than an inline
 * <script> block.
 *
 * Two reasons it lives here instead of in a component:
 *
 *   - `src/` contains no dangerouslySetInnerHTML, and next.config.ts leans on
 *     that when it explains why 'unsafe-inline' in script-src is survivable.
 *     Pasting Meta's snippet into a component would quietly retire that claim.
 *   - The pixel id is not a secret, but it is configuration: it arrives on the
 *     tag as a data attribute, so this file is identical in every deployment.
 *
 * Loads nothing and defines nothing when no id is present.
 */
(function () {
  var tag =
    document.currentScript || document.querySelector("script[data-pixel-id]");
  var id = tag && tag.getAttribute("data-pixel-id");
  if (!id || !/^\d{5,20}$/.test(id)) return;

  /*
   * Meta's own loader, verbatim apart from formatting — deliberately not
   * rewritten into a tidier shape. fbevents.js reads `window._fbq`, `fbq.queue`
   * and `fbq.callMethod` back out of what this sets up, so a clearer-looking
   * version is a version that silently stops queueing events fired before the
   * library lands. The two lint warnings below are that verbatim copy.
   */
  /* eslint-disable @typescript-eslint/no-unused-expressions */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(
    window,
    document,
    "script",
    "https://connect.facebook.net/en_US/fbevents.js",
  );

  /* eslint-enable @typescript-eslint/no-unused-expressions */

  window.fbq("init", id);
  /*
   * One PageView, for the landing-page number the ad manager already reports.
   * Every step after this one is sent explicitly by lib/funnel/track.ts, which
   * is the point of the exercise: the platform gets told about subscriptions,
   * not just arrivals.
   */
  window.fbq("track", "PageView");
})();
