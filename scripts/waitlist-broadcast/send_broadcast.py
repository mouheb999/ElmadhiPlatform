#!/usr/bin/env python3
"""
Send the ELMADHI early-access broadcast to the waitlist over Gmail SMTP.

Credentials come from a gitignored .smtp.env file next to this script (or from
real environment variables, which win over the file):

    ELMADHI_SMTP_USER=mou.heb142003@gmail.com
    ELMADHI_SMTP_PASS=your16charapppassword

ELMADHI_SMTP_PASS must be a Gmail *app password* (Google Account > Security >
2-Step Verification > App passwords), not the normal account password.

Usage:
    python send_broadcast.py --test you@example.com   # one email to yourself
    python send_broadcast.py --dry-run                # render, send nothing
    python send_broadcast.py --live                   # the real 323-person send
    python send_broadcast.py --live --limit 10        # first 10 only

The live send is resumable: every success is appended to sent.log and those
addresses are skipped if the script is run again.
"""

import argparse
import json
import os
import re
import smtplib
import ssl
import sys
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

CREDS_FILE = HERE / ".smtp.env"
APP_ENV = REPO / ".env.local"

# The landing-page project already holds a working Gmail app password. Read it
# in place rather than copying the secret into this repo.
FALLBACK_CREDS = Path(r"C:\Users\MSI\Desktop\landingPlatform\.env.local")
FALLBACK_KEYS = ("GMAIL_USER", "GMAIL_APP_PASSWORD")
LOGO = HERE / "logo_email.png"
FAILED_LOG = HERE / "failed.log"

RECIPIENTS = Path(
    r"C:\Users\MSI\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming"
    r"\Claude\local-agent-mode-sessions\593d888a-99e7-4298-9e7b-7fa47994cd25"
    r"\6832af5d-2cdc-42d0-927a-2cad8ce40b74\local_a1d6c9ba-5259-437d-81dd-5db909cabec7"
    r"\outputs\waitlist_full_fixed.json"
)

FROM_NAME = "ELMADHI team"
WHATSAPP_URL = "https://chat.whatsapp.com/CkDQ5RQF4VVLXxWgGBHYaF?s=cl&p=i&ilr=0"
CHECKOUT_URL = "https://elmadhi-platform.vercel.app/checkout"

# Founder's WhatsApp, for the "any questions" button.
SUPPORT_PHONE = "+216 24 146 409"
SUPPORT_WA = (
    "https://wa.me/21624146409?text="
    + urllib.parse.quote("Ahla, 3andi souel 3la ELMADHI platform")
)

# Two campaigns, two audiences. `waitlist` invites people who signed up on the
# landing page; `unpaid` nudges people who already have an account but never
# started a payment. Each keeps its own sent-log so one cannot skip the other.
CAMPAIGNS = {
    "waitlist": {
        "template": HERE / "template.html",
        "sent_log": HERE / "sent.log",
        "subject": "Ahla bik fi ELMADHI \U0001f389 acces 9bal ness lkol + group khass",
        "preheader": "Early access lel platform w group WhatsApp khass lel waiting list.",
    },
    "unpaid": {
        "template": HERE / "template_followup.html",
        "sent_log": HERE / "sent_followup.log",
        "subject": "Compte mte3ek fi ELMADHI mazel mawjoud \u23f3",
        "preheader": "Mouch lezem t3awed ta3mel compte jdid - ghir kammel w abda.",
    },
}

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def parse_env_file(path: Path) -> dict:
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def load_credentials():
    """Env vars win, then .smtp.env, then the landing project's Gmail creds."""
    local = parse_env_file(CREDS_FILE)
    shared = parse_env_file(FALLBACK_CREDS)

    user = (
        os.environ.get("ELMADHI_SMTP_USER")
        or local.get("ELMADHI_SMTP_USER")
        or shared.get(FALLBACK_KEYS[0], "")
    )
    pw = (
        os.environ.get("ELMADHI_SMTP_PASS")
        or local.get("ELMADHI_SMTP_PASS")
        or shared.get(FALLBACK_KEYS[1], "")
    )
    return user.strip(), pw.replace(" ", "")


def first_name(full_name: str) -> str:
    """Best-effort first token of the signup name, title-cased."""
    token = (full_name or "").strip().split()
    if not token:
        return ""
    name = re.sub(r"[^\w\u0600-\u06ff'-]", "", token[0])
    if not name:
        return ""
    return name if name.isupper() and len(name) <= 3 else name.capitalize()


def dedupe(rows):
    out, seen = [], set()
    for row in rows:
        email = (row.get("email") or "").strip()
        key = email.lower()
        if not EMAIL_RE.match(email) or key in seen:
            continue
        seen.add(key)
        out.append({"email": email, "name": first_name(row.get("name"))})
    return out


def load_waitlist():
    return dedupe(json.loads(RECIPIENTS.read_text(encoding="utf-8")))


def load_unpaid():
    """Accounts that never started a payment, read live from production.

    Deliberately `payment_status = 'unpaid'` and not `!= 'active'`: someone on
    `pending` has already sent money and is waiting on an admin to confirm it.
    Telling them to go pay would be wrong, so querying at send time is what
    keeps them out — and it also drops anyone who paid since the list was drawn.
    """
    env = parse_env_file(APP_ENV)
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    query = urllib.parse.urlencode({
        "select": "full_name,email",
        "payment_status": "eq.unpaid",
        "is_admin": "eq.false",
        "order": "created_at.desc",
    })
    req = urllib.request.Request(
        f"{base}/rest/v1/profiles?{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )

    # A dropped connection here used to abort the whole run before a single
    # email went out. Retry a few times before giving up.
    last_error = None
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
            break
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc
            print(f"  recipient lookup attempt {attempt} failed: {exc}", file=sys.stderr)
            time.sleep(2 * attempt)
    else:
        raise RuntimeError(f"could not fetch the unpaid list: {last_error}")

    return dedupe([{"email": r.get("email"), "name": r.get("full_name")} for r in rows])


def load_recipients(audience: str):
    return load_unpaid() if audience == "unpaid" else load_waitlist()


def render(name: str, campaign: dict) -> str:
    html = campaign["template"].read_text(encoding="utf-8")
    greeting = name if name else "bik"
    return (
        html.replace("__GREETING__", greeting)
        .replace("__WHATSAPP_URL__", WHATSAPP_URL)
        .replace("__CHECKOUT_URL__", CHECKOUT_URL)
        .replace("__SUPPORT_WA__", SUPPORT_WA)
        .replace("__SUPPORT_PHONE__", SUPPORT_PHONE)
        .replace("__PREHEADER__", campaign["preheader"])
    )


def plain_text(name: str, audience: str) -> str:
    return _plain_unpaid(name) if audience == "unpaid" else _plain_waitlist(name)


def _plain_unpaid(name: str) -> str:
    greeting = name if name else "bik"
    return f"""Ahla {greeting}!

Sajjelt fi ELMADHI ama ma kammeltech l'activation. Compte mte3ek mazel
mawjoud, mouch lezem t3awed ta3mel wa7ed jdid - ghir tkammel w tabda.

Chnowa yestannek fel platform:

  * Programme mous9a 3la 7asb jismek, ahdafek w wa9tek
  * N'dham makla b macros m7soubin, w b makla tounsiya
  * Suivi lel progres mte3ek w tabdil fel plan ki tel'zem

Yabda men 29 DT fi chhar - w a7san 9ima 3 chhour b 69 DT.
Tnajjem tkhalles b D17, Flouci, virement bancaire wella crypto.

Kammel w abda:
{CHECKOUT_URL}

Ken 3andek souel, kallemna 3la WhatsApp {SUPPORT_PHONE} wella rodd 3la l'email hedha.

--
ELMADHI team
Ifhem jismek. Ebni nathamek. Wally el coach mte3 rou7ek.
"""


def _plain_waitlist(name: str) -> str:
    greeting = name if name else "bik"
    return f"""Ahla {greeting}!

Nochkrouk elli sajalt maana fi l waiting list mteena, tawa 3andk acces 9bal
ness lkol ala Elmadhi Platform, 3amalnalek group khass fih:

  * Early access lel platform 9bal koll 7add
  * Kol l akhbar w details 3la kifech todkhl we tetsaaml l platform

Hedha lien group whatsapp:
{WHATSAPP_URL}

Nestnewk fel group!

--
ELMADHI team
Ifhem jismek. Ebni nathamek. Wally el coach mte3 rou7ek.
"""


def build_message(
    sender: str, to_email: str, name: str, logo_bytes: bytes,
    campaign: dict, audience: str,
) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = campaign["subject"]
    msg["From"] = formataddr((FROM_NAME, sender))
    msg["To"] = to_email
    msg["Reply-To"] = sender

    msg.set_content(plain_text(name, audience))

    logo_cid = make_msgid(domain="elmadhi.local")
    html = render(name, campaign).replace("cid:elmadhilogo", f"cid:{logo_cid[1:-1]}")
    msg.add_alternative(html, subtype="html")

    msg.get_payload()[1].add_related(
        logo_bytes, "image", "png", cid=logo_cid, filename="logo.png"
    )
    return msg


def load_sent(campaign: dict) -> set:
    log = campaign["sent_log"]
    if not log.exists():
        return set()
    return {
        line.split("\t")[0].strip().lower()
        for line in log.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--test", metavar="EMAIL", help="send a single test email")
    mode.add_argument("--dry-run", action="store_true", help="render only, send nothing")
    mode.add_argument("--live", action="store_true", help="send to the whole waitlist")
    ap.add_argument("--name", default="", help="greeting name to use with --test")
    ap.add_argument("--limit", type=int, default=0, help="cap the number sent")
    ap.add_argument("--delay", type=float, default=4.0, help="seconds between sends")
    ap.add_argument(
        "--audience", choices=sorted(CAMPAIGNS), default="waitlist",
        help="waitlist = landing-page signups; unpaid = accounts that never paid",
    )
    args = ap.parse_args()

    campaign = CAMPAIGNS[args.audience]
    sender, password = load_credentials()

    if args.dry_run:
        people = load_recipients(args.audience)
        if args.limit:
            people = people[: args.limit]
        preview = HERE / f"preview_{args.audience}.html"
        # swap the CID for the on-disk file so the preview renders in a browser
        preview.write_text(
            render(people[0]["name"] if people else "", campaign)
            .replace("cid:elmadhilogo", LOGO.name),
            encoding="utf-8",
        )
        print(f"audience={args.audience}  subject={campaign['subject']!r}")
        print(f"{len(people)} recipients would be emailed.")
        print("First 5:", ", ".join(f"{p['name']} <{p['email']}>" for p in people[:5]))
        print(f"Preview written to {preview}")
        return 0

    if not sender or not password:
        print(
            f"Missing SMTP credentials.\n"
            f"Create {CREDS_FILE} containing:\n"
            f"  ELMADHI_SMTP_USER=mou.heb142003@gmail.com\n"
            f"  ELMADHI_SMTP_PASS=<gmail app password>\n",
            file=sys.stderr,
        )
        return 2

    if not LOGO.exists():
        print(f"Logo not found at {LOGO}", file=sys.stderr)
        return 2
    logo_bytes = LOGO.read_bytes()

    print(f"Authenticating as {sender} (app password: {len(password)} chars).")

    if args.test:
        targets = [{"email": args.test, "name": first_name(args.name)}]
    else:
        already = load_sent(campaign)
        targets = [
            p for p in load_recipients(args.audience)
            if p["email"].lower() not in already
        ]
        if already:
            print(f"Skipping {len(already)} already-sent addresses.")
        if args.limit:
            targets = targets[: args.limit]
        print(
            f"About to send {len(targets)} '{args.audience}' emails "
            f"as {FROM_NAME} <{sender}>."
        )

    context = ssl.create_default_context()
    sent = failed = 0
    # Once Gmail starts refusing (daily quota, rate limit), every further send
    # is another rejection against the same account. Stop rather than hammer it
    # — sent_log means the run picks up cleanly tomorrow.
    consecutive_failures = 0
    ABORT_AFTER = 5

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=60) as server:
        server.starttls(context=context)
        server.login(sender, password)

        for i, person in enumerate(targets, 1):
            try:
                server.send_message(build_message(
                    sender, person["email"], person["name"], logo_bytes,
                    campaign, args.audience,
                ))
                sent += 1
                if not args.test:  # keep the resume log free of test sends
                    with campaign["sent_log"].open("a", encoding="utf-8") as fh:
                        fh.write(f"{person['email']}\t{time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                consecutive_failures = 0
                print(f"[{i}/{len(targets)}] sent -> {person['email']}")
            except smtplib.SMTPException as exc:
                failed += 1
                consecutive_failures += 1
                with FAILED_LOG.open("a", encoding="utf-8") as fh:
                    fh.write(f"{person['email']}\t{exc}\n")
                print(f"[{i}/{len(targets)}] FAILED -> {person['email']}: {exc}", file=sys.stderr)
                if consecutive_failures >= ABORT_AFTER:
                    print(
                        f"\nABORTED: {ABORT_AFTER} failures in a row — the account is "
                        f"probably rate-limited or over quota. {sent} sent so far; "
                        f"re-run later to resume.",
                        file=sys.stderr,
                    )
                    break

            if i < len(targets):
                time.sleep(args.delay)

    print(f"\nDone. Sent {sent}, failed {failed}.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
