# SubSniper — Reddit Lead Sniper

Score buying-intent on the Reddit threads you're **already reading**, save the hot
leads, and draft a reply you **copy and paste yourself**. SubSniper is an
in-thread lead-generation tool for founders and marketers. It runs **100%
client-side** on your own logged-in reddit.com session.

---

## The two guardrails (why this exists and why it's viable)

1. **Client-side only.** SubSniper makes **no Reddit API calls, no scraping
   backend, and talks to no server.** It only reads the DOM of reddit.com pages
   you are already viewing in your logged-in browser. This deliberately stays
   clear of Reddit's 2025 commercial-API-use restrictions — there is no API use.

2. **Zero auto-posting, ever.** SubSniper **never** submits, posts, comments,
   upvotes, or interacts with Reddit on your behalf. The reply composer produces
   a **draft** in a copy box with a prominent **"Copy — paste it yourself"**
   button. You read it, make it sound like you, and post it manually. There is
   no code path anywhere in this extension that writes to Reddit.

The only network request the extension can *ever* make is the **optional** AI
draft: a direct call from your browser to **your own** Anthropic API key. Turn
it off (leave the key blank) and SubSniper is fully offline.

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

## Free vs Pro

| | Free | Pro |
|---|---|---|
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

To run the intent-engine unit tests:

```bash
node --test src/common/intent-engine.test.mjs
```

---

## Publish it to the Chrome Web Store

1. **Register** a Chrome Web Store developer account at
   <https://chrome.google.com/webstore/devconsole> — this is a **one-time $5
   fee** paid to Google (you do this yourself; it needs your payment method).
2. **Zip the folder.** From inside `SubSniper/`:
   ```bash
   zip -r ../subsniper.zip . -x ".*" -x "__MACOSX"
   ```
   (Ship `manifest.json`, `src/`, and `assets/`. The tests and this README are
   harmless to include but can be excluded.)
3. In the dev console, click **New item** and upload `subsniper.zip`.
4. Fill in the **listing**: name, summary, description, at least one 1280×800
   screenshot, the 128×128 icon (`assets/icon128.png`), and category
   (Productivity / Social).
5. Complete **Privacy practices**: declare that all processing is local, no
   remote data collection, and paste/link `PRIVACY.md`. Declare the single
   remote host (`api.anthropic.com`) as *optional, user-initiated, uses the
   user's own key*. Justify the `storage` and `activeTab` permissions and the
   `*.reddit.com` host permission (reads page content to score leads).
6. Submit for review. Approval typically takes a few days.

> **Go-to-market reality check.** Chrome Web Store search is **not** your
> distribution channel — nobody searches "reddit lead extension". Your
> distribution *is the product itself*: use SubSniper on your own Reddit
> outreach, share wins, and let founders who see your genuinely-helpful replies
> ask what you use. Demo it in the exact subreddits your buyers live in.

---

## Wire up the Pro subscription

The license check ships as an **honest local stub** (`src/common/license.js`)
so the extension is fully functional and reviewable offline. Swap it for real
verification when you're ready:

### Option A — ExtensionPay (easiest for extensions)

<https://extensionpay.com> — handles Stripe, trials, and the paywall UI.

1. Create an account and register the extension id `subsniper`.
2. Add `extpay.js`, and in `src/background/service-worker.js`:
   ```js
   const extpay = ExtPay('subsniper');
   extpay.startBackground();
   ```
3. In `license.js`, replace `getStatus()` / `isPro()` with
   `const user = await extpay.getUser()` and gate on `user.paid`.
4. Replace `startCheckout()` with `extpay.openPaymentPage()`.

### Option B — Gumroad license keys

<https://gumroad.com> — sell a membership, enable "Generate license keys".

1. Point `CHECKOUT_URL` in `license.js` at your Gumroad product URL.
2. In the background worker, verify a key server-lessly:
   ```
   POST https://api.gumroad.com/v2/licenses/verify
        { product_id, license_key, increment_uses_count: false }
   ```
   Gate on `success && !purchase.refunded && purchase.subscription_ended_at == null`.

Both spots are marked with `WIRE-UP:` comments in `src/common/license.js`.

---

## Project layout

```
SubSniper/
├── manifest.json                 MV3 manifest (zero-build)
├── README.md · PRIVACY.md · BUILD_REPORT.md
├── assets/
│   ├── generate-icon.py          Pillow icon generator
│   └── icon16/48/128.png         Generated icons (+ 1024 master)
└── src/
    ├── common/                   Shared logic (global namespace, no ES imports)
    │   ├── constants.js          Namespace bootstrap, defaults, thresholds
    │   ├── storage.js            chrome.storage wrapper (sync + local)
    │   ├── intent-engine.js      The scorer (pure, explainable, testable)
    │   ├── intent-engine.test.mjs  node --test unit tests
    │   ├── dom-reddit.js         New + old Reddit DOM adapters
    │   ├── draft.js              Template + AI-request composer (never posts)
    │   └── license.js            Free/Pro gating (local stub → ExtensionPay/Gumroad)
    ├── content/
    │   ├── content.js            Orchestrator (scan → score → badge → sidebar)
    │   ├── sidebar.js            Panel + lead cards + composer modal
    │   ├── sidebar.css · badges.css
    ├── background/
    │   └── service-worker.js     Checkout tabs + optional Anthropic fetch
    ├── popup/                    Stats + master on/off toggle
    └── options/                  Products, lexicon tuner, AI key, license
```

## Privacy

See [PRIVACY.md](./PRIVACY.md). Short version: everything runs on your device.
The only data that can leave your browser is an optional AI draft request that
**you** trigger, sent directly to Anthropic using **your own** API key.
