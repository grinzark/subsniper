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

## Pricing — a config-driven Pro gate (ON since v0.2.0)

Billing is a **switch** in `src/common/billing-config.js`:

| `LEMON_SQUEEZY` fields | Behaviour |
|---|---|
| `storeId`, `productId` or `checkoutUrl` empty | Free-only. Everything unlocked, no upgrade buttons, no license UI. |
| all three set (**as shipped in v0.2.0**) | Pro gate ON. **Free** = 1 tracked product + template drafts. **Pro** (£29/month via Lemon Squeezy) = unlimited products + AI drafts. "Upgrade" opens the Lemon Squeezy checkout. |

`variantId` is **optional** — it's never used for verification (the worker
enforces `store_id` + `product_id` on the server's response and only caches
`meta.variant_id`). Fill it in later from the first activated license: Options →
Plan & license shows "variant <id>" once Pro is active.

When the gate is on, Pro is granted **only** from a Lemon Squeezy server
verification performed by the background worker (`/v1/licenses/activate`, then
`/v1/licenses/validate` every ~24h) and only while the license status is
`active`. The verified result is cached locally with a 3-day offline grace.
There is no client-side check to bypass — the gate logic is a pure function
covered by `src/common/license.test.mjs`. Live values and the money-path test:
[LAUNCH.md → section 6](./LAUNCH.md#6-pro-billing-is-on-v020--lemon-squeezy-live-config).

---

## Changing the billing config

Edit the values in `src/common/billing-config.js` (store id, product id,
checkout URL — `variantId` optional), bump the manifest version, rebuild the
zip, re-upload. How to test the money path in Lemon Squeezy's test mode is in
[LAUNCH.md → section 6](./LAUNCH.md#6-pro-billing-is-on-v020--lemon-squeezy-live-config).

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
    │   ├── billing-config.js     THE BILLING SWITCH (Lemon Squeezy ids; live since v0.2.0)
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
