# SubSniper — Reddit Lead Sniper

_Publisher: **zarkside** · Legal data controller: **Mohamed Y. (trading as zarkside)**, UK
sole trader. Launch steps live in [LAUNCH.md](./LAUNCH.md)._

Score buying-intent on the Reddit threads you're **already reading**, save the hot
leads, and draft a reply you **copy and paste yourself**. SubSniper is an
in-thread lead-generation tool for founders and marketers. Scoring runs
**locally by default** on your own logged-in reddit.com session — the only thing
that ever leaves your browser is an optional AI draft you explicitly request,
sent with your own Anthropic key.

---

## The two guardrails (why this exists and why it's viable)

1. **Client-side scoring, no SubSniper server.** SubSniper makes **no Reddit API
   calls and runs no backend of its own.** It only reads the DOM of reddit.com
   pages you are already viewing in your logged-in browser, and all lead scoring
   happens on your device. This deliberately stays clear of Reddit's 2025
   commercial-API-use restrictions — there is no API use.

2. **Zero auto-posting, ever.** SubSniper **never** submits, posts, comments,
   upvotes, or interacts with Reddit on your behalf. The reply composer produces
   a **draft** in a copy box with a prominent **"Copy — paste it yourself"**
   button. You read it, make it sound like you, and post it manually. There is
   no code path anywhere in this extension that writes to Reddit.

**The one exception to "nothing leaves your browser"** is the **optional** AI
draft. If you add your own Anthropic API key and click *Generate with AI*, that
post's text and your product details are sent directly from your browser to
`api.anthropic.com` — nowhere else, authenticated with your key. Leave the key
blank and SubSniper is fully offline. Your key is stored only on your device
(never in Chrome sync) and is never loaded into the script that runs on Reddit.

---

## What it does

- **Intent badges** — every post/comment that mentions your product's keywords
  gets an inline badge colored by intent: 🔥 **Hot ≥70**, 🌤 **Warm 40–69**,
  ❄️ **Cold <40**. Click a badge to jump to that lead in the side panel.
- **Explainable scoring** — the local intent engine shows **why** something
  scored the way it did (matched keywords + weighted buying-intent signals like
  "looking for", "alternative to", "frustrated with", minus self-promo).
- **Saved-leads sidebar** — a slide-in panel lists this page's leads sorted by
  score, filterable by bucket, with Save / Draft reply / Open thread actions.
- **Draft composer** — 2–3 non-spammy template variants (tone: helpful /
  concise / founder-to-founder) that mirror the person's pain, give one helpful
  line, and end with a soft, honest mention. Optional AI drafts with your key.

## Pricing — a config-driven Pro gate (OFF in v0.1.0)

Billing is a **switch** in `src/common/billing-config.js`:

| `LEMON_SQUEEZY` fields | Behaviour |
|---|---|
| any empty (**as shipped**) | Free-only. Everything unlocked, no upgrade buttons, no license UI. |
| all four set | Pro gate ON. **Free** = 1 tracked product + template drafts. **Pro** = unlimited products + AI drafts. "Upgrade" opens the Lemon Squeezy checkout. |

When the gate is on, Pro is granted **only** from a Lemon Squeezy server
verification performed by the background worker (`/v1/licenses/activate`, then
`/v1/licenses/validate` every ~24h) and only while the license status is
`active`. The verified result is cached locally with a 3-day offline grace.
There is no client-side check to bypass — the gate logic is a pure function
covered by `src/common/license.test.mjs`. How to fill in the four values:
[LAUNCH.md → section 6](./LAUNCH.md#6-switch-on-pro-billing-lemon-squeezy--when-youre-ready-to-charge).

---|---|---|
| Tracked products | 1 | Unlimited |
| Saved leads | 15 | Unlimited |
| Template drafts | ✓ | ✓ |
| AI drafts (your own key) | — | ✓ |

---

## Install it (Load unpacked — no build step)

SubSniper is **zero-build**: plain modern JS, no bundler, no toolchain.

1. Open `chrome://extensions` in Chrome (or any Chromium browser).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder (`SubSniper/`).
4. The Options page opens on first install — add your product name, keywords,
   synonyms, a one-line pitch, and URL.
5. Open any **reddit.com** thread, subreddit, or search. Matching posts get an
   intent badge, and the floating 🎯 button (bottom-right) opens the panel.

To regenerate the icons after editing the design:

```bash
python3 assets/generate-icon.py     # needs Pillow
```

To run the unit tests (intent engine + the Pro gate):

```bash
node --test src/common/*.test.mjs
```

---

## Publish it to the Chrome Web Store

> **The authoritative, click-by-click version of this — with the final listing
> copy, the exact Privacy-practices answers, and the screenshot plan — is
> [LAUNCH.md](./LAUNCH.md).** The summary below is kept for orientation.

1. **Register** a Chrome Web Store developer account at
   <https://chrome.google.com/webstore/devconsole> — this is a **one-time $5
   fee** paid to Google (you do this yourself; it needs your payment method).
2. 🚩 **HOST `PRIVACY.md` AT A PUBLIC URL — YOU MUST DO THIS FIRST.**
   **Chrome will not let you complete the Privacy practices tab without a
   working privacy-policy URL, so the submission is blocked until this exists.**
   A file sitting in this repo is *not* enough — it needs to be a real, publicly
   reachable web page. Free options, pick one:
   - **GitHub Pages** (easiest): a ready-made page is in `docs/index.html`.
     Push this repo to GitHub (account `grinzark`) → **Settings → Pages** →
     Source: *Deploy from a branch*, branch `main`, folder **`/docs`** → Save.
     After ~1 minute your policy is live at
     `https://grinzark.github.io/<repo>/` (exact commands in LAUNCH.md §1).
   - Or paste the contents into a GitHub **Gist**, Notion public page, or any
     page on your own domain.

   Then copy that URL — you paste it into the dashboard in step 6. The required
   Limited Use sentence is already in `PRIVACY.md`; don't delete it.
3. **Zip the folder** — use the pre-built package at the repo root
   (`SubSniper-v0.1.0.zip`), or rebuild the minimal runtime set:
   ```bash
   zip -r SubSniper-v0.1.0.zip manifest.json src assets \
     -x "src/common/*.test.mjs" "assets/generate-icon.py" \
        "assets/icon.png" "assets/icon1024.png" "*.DS_Store"
   ```
   (Ship only `manifest.json`, `src/`, and `assets/` icons — not the tests,
   the icon generator, or the docs.)
4. In the dev console, click **New item** and upload the zip.
5. Fill in the **listing**: name, summary, description, at least one 1280×800
   screenshot, the 128×128 icon (`assets/icon128.png`), and category
   (Productivity / Social).
6. Complete **Privacy practices** — **be precise here; an inaccurate disclosure
   is grounds for removal:**
   - Paste the **privacy-policy URL from step 2**.
   - Declare that lead scoring runs locally on the user's device and that
     SubSniper operates no server of its own — but **do not claim "no remote
     data collection" or "all processing is local" without qualification.**
     That would be false: if the user opts in to AI drafts, the text of the
     selected Reddit post is sent to `api.anthropic.com`. Disclose that host as
     *optional, user-initiated, authenticated with the user's own API key*, and
     tick the corresponding data-use boxes honestly.
   - Justify the **`storage`** permission (saving settings and leads locally),
     the **`*.reddit.com`** host permission (reads page content to score leads;
     read-only, never writes), and the two **optional** hosts
     (`api.anthropic.com` for user-keyed AI drafts, `api.lemonsqueezy.com` for
     license verification). Exact wording in LAUNCH.md §4.
   - The extension does **not** post, comment, or vote on the user's behalf —
     that claim is true and worth stating.
7. Submit for review. Approval typically takes a few days.

> **Go-to-market reality check.** Chrome Web Store search is **not** your
> distribution channel — nobody searches "reddit lead extension". Your
> distribution *is the product itself*: use SubSniper on your own Reddit
> outreach, share wins, and let founders who see your genuinely-helpful replies
> ask what you use. Demo it in the exact subreddits your buyers live in.

---

## Turning on Pro billing

Fill the four values in `src/common/billing-config.js` (store id, product id,
variant id, checkout URL — all from your Lemon Squeezy dashboard), bump the
manifest version, rebuild the zip, re-upload. Full walkthrough, including how to
test the money path in Lemon Squeezy's test mode, is in
[LAUNCH.md → section 6](./LAUNCH.md#6-switch-on-pro-billing-lemon-squeezy--when-youre-ready-to-charge).

## Project layout

```
SubSniper/
├── manifest.json                 MV3 manifest (zero-build)
├── README.md · PRIVACY.md · LAUNCH.md · BUILD_REPORT.md
├── docs/
│   ├── index.html                Hosted privacy page (GitHub Pages, /docs)
│   └── .nojekyll
├── assets/
│   ├── generate-icon.py          Pillow icon generator
│   └── icon16/48/128.png         Generated icons (+ 1024 master)
└── src/
    ├── common/                   Shared logic (global namespace, no ES imports)
    │   ├── constants.js          Namespace bootstrap, defaults, thresholds
    │   ├── storage.js            chrome.storage wrapper (sync/local split, honest errors)
    │   ├── intent-engine.js      The scorer (pure, explainable, testable)
    │   ├── intent-engine.test.mjs  node --test unit tests
    │   ├── dom-reddit.js         New + old Reddit DOM adapters
    │   ├── draft.js              Template + AI-request composer (never posts)
    │   ├── billing-config.js     THE BILLING SWITCH (Lemon Squeezy ids; empty = free-only)
    │   ├── license.js            Pro gate: pure computeStatus() + worker messaging
    │   └── license.test.mjs      node --test for the gate
    ├── content/
    │   ├── content.js            Orchestrator (scan → score → badge → sidebar)
    │   ├── sidebar.js            Panel + lead cards + composer modal
    │   ├── sidebar.css · badges.css
    ├── background/
    │   └── service-worker.js     The ONLY network code: Anthropic + Lemon Squeezy, allow-listed
    ├── popup/                    Stats + master on/off toggle
    └── options/                  Products, lexicon tuner, AI key, license
```

## Privacy

See [PRIVACY.md](./PRIVACY.md). Short version: lead scoring runs on your device
and SubSniper operates no server of its own. The only data that can leave your
browser is an optional AI draft request that **you** trigger, sent directly to
Anthropic using **your own** API key.

**Publishing?** `PRIVACY.md` must be hosted at a public URL before the Chrome
Web Store will let you complete the Privacy practices tab — see step 2 of
[Publish it to the Chrome Web Store](#publish-it-to-the-chrome-web-store).
