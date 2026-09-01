# SubSniper — Launch Kit

Everything needed to get SubSniper **live on the Chrome Web Store and taking
money**, in the order to do it.

**Names to use — do not mix them up:**
- **Brand / publisher display name** (CWS "Offered by", support contact, Lemon
  Squeezy store name): **zarkside**
- **Legal data controller** (privacy policy only): **Mohamed Y. (trading as zarkside)**,
  UK sole trader

Two things are already true and stay true throughout: SubSniper **never posts to
Reddit for the user**, and it **never contacts any host other than
`api.anthropic.com` and `api.lemonsqueezy.com`** — both optional, both
user-initiated.

---

## 0. What's done vs. what only you can do

| Done (in this repo) | Only you can do |
|---|---|
| Extension built, tested, zipped (`SubSniper-v0.1.0.zip`) | Push to GitHub + turn on Pages (step 1) |
| Privacy policy written (`PRIVACY.md`) + hosted-page version (`docs/index.html`) | Register the CWS developer account, pay the $5 (step 2) |
| Limited Use statement included verbatim | Upload, fill the listing, submit (steps 2–4) |
| Listing copy, privacy-tab answers, screenshot plan (below) | Take the 5 screenshots (step 5) |
| Lemon Squeezy billing wired, server-verified, switched OFF by config | Create the LS store/product and fill 4 config values (step 6) |

---

## 1. Host the privacy policy (do this FIRST — it blocks submission)

Chrome will not let you finish the **Privacy practices** tab without a working,
public privacy-policy URL. `docs/index.html` is a self-contained page ready for
GitHub Pages. Your GitHub account is **grinzark**.

```bash
# In /Users/mohamedy/SubSniper — the repo is already initialised on `main`.
# 1) Create an EMPTY repo on GitHub named  subsniper  (public), no README/licence.
#    https://github.com/new
# 2) Point this repo at it and push:
git remote add origin https://github.com/grinzark/subsniper.git
git push -u origin main
```

Then in the browser:

1. Open **https://github.com/grinzark/subsniper/settings/pages**
2. **Build and deployment → Source:** *Deploy from a branch*
3. **Branch:** `main` &nbsp; **Folder:** `/docs` → **Save**
4. Wait ~1 minute. Your policy is live at:

   **`https://grinzark.github.io/subsniper/`**

   (If you name the repo something else, the URL is
   `https://grinzark.github.io/<repo>/`.)

5. Open it, confirm you see the page and the sentence beginning
   *"SubSniper's use and transfer of information…"*. Copy the URL — you paste it
   in step 4.

`docs/.nojekyll` is already present so Pages serves the folder as-is.

---

## 2. Chrome Web Store — click-by-click

1. Go to **https://chrome.google.com/webstore/devconsole** and sign in with the
   Google account you want to publish under.
2. Accept the developer agreement and pay the **one-time US$5 registration fee**
   (card required). This is the only cost.
3. Under **Account**, set your **publisher display name** to **`zarkside`**
   (this is the "Offered by" shown on the listing) and a **contact email**,
   then verify the email (there's a *Verify* link). An unverified contact
   email blocks publishing.
4. Click **+ New item**.
5. **Upload** `SubSniper-v0.1.0.zip` from the repo root. The console parses the
   manifest and shows any errors — there should be none.
6. You'll land on the item's **Store listing** tab. Fill it using section 3.
   - **Category:** *Productivity* → *Workflow & Planning* (fallback: *Social &
     Communication* is wrong for this — it's a work tool).
   - **Language:** *English (United Kingdom)* (or *English*).
7. **Privacy practices** tab — use section 4 verbatim.
8. **Distribution** tab: *Public*, all regions, free (Pro is sold outside the
   store via Lemon Squeezy, which is allowed — payment happens on your site,
   not through the extension).
9. Click **Submit for review**. Leave *Publish automatically after review*
   ticked unless you want to time the launch.

---

## 3. Final listing copy

**Offered by** (publisher display name, set under Account): `zarkside`

**Title** (manifest name; 30 chars, limit 45)

```
SubSniper — Reddit Lead Sniper
```

**Short description** (129 chars, limit 132)

```
Score buying-intent on Reddit threads you already read. Local scoring, saved leads, drafts you paste yourself. Never posts for you.
```

**Full description**

```
SubSniper finds the people on Reddit who are actually looking for what you sell — while you're already reading the thread.

Add your product's keywords once. Then, on any reddit.com page, every post or comment that mentions them gets a small intent badge: Hot, Warm or Cold, with a score out of 100. Click it and SubSniper shows you exactly WHY it scored that way — "asking for a recommendation", "frustrated with current tool", "wants an alternative to…", minus penalties for self-promotion — so you can trust the number.

The side panel lists this page's leads sorted by score. Save the good ones. When you're ready to reply, hit Draft: SubSniper writes 2–3 short, non-spammy variants in your chosen tone (helpful / concise / founder-to-founder) that mirror the person's actual problem, give one useful line, and mention your product honestly at the end. You edit it, copy it, and paste it into Reddit yourself.

HOW IT WORKS — AND WHY IT'S SAFE
• Scoring runs entirely on your device, on pages you're already viewing in your own logged-in session. No Reddit API. No scraping. No SubSniper server.
• It never posts, comments, upvotes, or acts on your behalf. Drafts are copy-and-paste only. There is no code path that writes to Reddit.
• Optional AI drafts use YOUR OWN Anthropic API key, sent directly from your browser to Anthropic — only when you click "Generate with AI". Leave the key blank and SubSniper is fully offline.

FREE vs PRO
Free tracks one product with template drafts. Pro (subscription via Lemon Squeezy) unlocks unlimited products and AI drafts. Until Pro is switched on, everything is free.

Built by a founder, for founders: this is the in-thread tool I wanted for my own Reddit outreach.
```

**5 feature bullets** (for the listing's highlights / screenshots)

1. **Intent badges in the thread** — Hot / Warm / Cold with a 0–100 score, on
   new and old Reddit.
2. **Explainable scoring** — see the exact matched signals behind every score;
   tune the weights yourself.
3. **Saved-leads side panel** — this page's leads, sorted by score, filterable,
   one click to the thread.
4. **Reply drafts you paste yourself** — 2–3 non-spammy variants in three tones,
   with your product mentioned honestly.
5. **Local by default** — no server, no analytics; optional AI with your own
   key; never posts for you.

**Honest "what it does NOT do" line** (put it in the description — reviewers
and users both like it)

```
SubSniper does NOT post, reply, upvote or DM on Reddit for you, does NOT use the Reddit API, and does NOT send page content anywhere unless you explicitly click "Generate with AI" with your own key.
```

---

## 4. Privacy practices tab — exact answers

**Single purpose description**

```
SubSniper scores the Reddit posts and comments already on the user's screen for buying-intent against the user's own product keywords, shows an inline badge, and lets the user save leads and compose reply drafts they copy and paste themselves. All scoring runs locally in the browser.
```

**Permission justifications**

- `storage` —
  ```
  Stores the user's product keywords, tuned scoring weights, saved leads, preferences and (optionally) their own Anthropic API key and Pro license state, locally in the browser. Nothing is sent to a SubSniper server; there is none.
  ```
- Host permission `https://*.reddit.com/*` —
  ```
  Required to read the post and comment text on reddit.com pages the user is viewing so it can be scored locally, and to display the intent badge and side panel on that page. Read-only: the extension never posts, votes, or writes to Reddit.
  ```
- Optional host permission `https://api.anthropic.com/*` —
  ```
  Requested only when the user enters their own Anthropic API key. Used solely to send the selected post's text and the user's product details to Anthropic to generate a reply draft, and only when the user clicks "Generate with AI". Never used otherwise.
  ```
- Optional host permission `https://api.lemonsqueezy.com/*` —
  ```
  Requested only when the user activates a Pro license key. Used solely to send that license key and an activation instance id to Lemon Squeezy (our Merchant of Record) to verify the subscription is active. No page content or other data is sent.
  ```
- Remote code: **No** — all code is in the package; no eval, no remote scripts.

**Data usage disclosure — tick exactly these**

| Data type | Collected? | Notes to enter |
|---|---|---|
| Personally identifiable information | **No** | — |
| Health / Financial / Payment info | **No** | Payments happen on Lemon Squeezy's site; the extension never sees them |
| Authentication information | **Yes** | User-entered Anthropic API key and Pro license key, stored locally only; key sent only to Anthropic; license key sent only to Lemon Squeezy |
| Personal communications | **No** | — |
| Location | **No** | — |
| Web history | **No** | Only the current reddit.com page is read, and only while it's open |
| User activity | **No** | — |
| Website content | **Yes** | Text of reddit.com posts/comments on the current page is read and scored **locally**. It is sent off-device **only** if the user clicks "Generate with AI" (to api.anthropic.com, with the user's own key). |

**Certifications (tick all three — each is true)**

- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Limited Use:** the affirmative statement is on the hosted policy page:
*"SubSniper's use and transfer of information received from Chrome APIs adheres
to the Chrome Web Store User Data Policy, including the Limited Use
requirements."* — answer **YES** / compliant.

**Privacy policy URL:** `https://grinzark.github.io/subsniper/` (from step 1).

---

## 5. Screenshot plan — 5 × 1280×800 PNG

Take these on a real Reddit thread where your keywords match (a `r/startups` or
`r/SaaS` "what CRM do you use?" thread is ideal). Light mode reads better in the
store. Crop to exactly 1280×800.

| # | Shows | How |
|---|---|---|
| 1 | **Hero: badges in the thread** — 2–3 posts with Hot/Warm badges visible, FAB bottom-right | Thread page, panel closed. Caption: *"Spot buying-intent while you read."* |
| 2 | **Side panel with WHY** — panel open, top card Hot with its reason chips | Click the FAB. Caption: *"See exactly why it scored — then save it."* |
| 3 | **Draft composer** — tone selector, disclaimer, one variant, the orange "Copy — paste it yourself" button | Click *Draft reply* on a card. Caption: *"Drafts you paste yourself. It never posts for you."* |
| 4 | **Options: products & keywords** — one product filled in, the intent-signal tuner just visible below | `chrome://extensions` → Details → Extension options. Caption: *"Your keywords. Your weights."* |
| 5 | **Popup** — toggle on, today's counts, "Local by default · never posts for you" | Click the toolbar icon; screenshot the popup over a Reddit page. Caption: *"On-device. Private. Yours."* |

Also upload the **128×128 icon** (`assets/icon128.png`). A 440×280 small promo
tile is optional but worth 10 minutes: icon on the dark background + the title.

---

## 6. Switch on Pro billing (Lemon Squeezy) — when you're ready to charge

Billing is **OFF** in `SubSniper-v0.1.0.zip` by design: every field in
`src/common/billing-config.js` is empty, so the extension is free-only with no
upgrade buttons. Flip it on like this:

1. **Create a Lemon Squeezy account + store** at https://app.lemonsqueezy.com
   — store name **zarkside**; legal/payout details as **Mohamed Y. (trading as zarkside)**, UK
   sole trader. Lemon Squeezy is the Merchant of Record —
   it handles VAT, receipts and refunds.
2. **Products → New product → "SubSniper Pro"**, type **Subscription**, add a
   monthly variant (and optionally yearly). Suggested launch price: £9/mo.
3. On the product, enable **"Generate license keys"** and set the activation
   limit (3 is generous for one person's browsers).
4. Collect the four values:
   - **Store ID** — Settings → Stores (numeric)
   - **Product ID** — the product's page URL / API id (numeric)
   - **Variant ID** — the subscription variant's id (numeric)
   - **Checkout URL** — the product's *Share* link, e.g.
     `https://<store>.lemonsqueezy.com/checkout/buy/<uuid>`
5. Fill them into `src/common/billing-config.js`:
   ```js
   const LEMON_SQUEEZY = {
     storeId: '12345',
     productId: '67890',
     variantId: '11111',
     checkoutUrl: 'https://moe.lemonsqueezy.com/checkout/buy/xxxxxxxx-...'
   };
   ```
   The moment all four are non-empty, the Pro gate turns on: Free = 1 product +
   template drafts; Pro = unlimited products + AI drafts; "Upgrade" opens the
   checkout. Nothing else to change.
6. Bump `"version"` in `manifest.json` (e.g. `0.2.0`), run the checks, rebuild
   the zip, and upload the new version in the dev console (**Package → Upload
   new package**). Update the listing description's FREE vs PRO paragraph.
   ```bash
   node --test src/common/*.test.mjs
   rm -f SubSniper-v0.2.0.zip && zip -r -X SubSniper-v0.2.0.zip manifest.json src assets \
     -x "src/common/*.test.mjs" "assets/generate-icon.py" "assets/icon.png" "assets/icon1024.png" "*.DS_Store"
   ```
7. **Test the money path yourself before announcing:** buy Pro with Lemon
   Squeezy's *test mode* card, paste the license key into Options → *Plan &
   license* → **Activate**, confirm the pill turns **Pro**, then cancel the test
   subscription and confirm "Re-check now" drops you back to Free.

How verification works (so you can answer support questions): activation calls
`POST api.lemonsqueezy.com/v1/licenses/activate`; every ~24h the background
worker calls `/v1/licenses/validate`; Pro is granted **only** when the server
says the key is valid **and** its status is `active`. If Lemon Squeezy can't be
reached, Pro survives up to 3 days on the last good check, then falls back to
Free. There is no client-side check to bypass.

---

## 7. Pre-submit checklist

- [ ] Privacy page live at `https://grinzark.github.io/subsniper/` and shows the Limited Use sentence
- [ ] CWS developer account registered, $5 paid, contact email **verified**
- [ ] `SubSniper-v0.1.0.zip` uploads with zero manifest warnings
- [ ] Title / short / full description pasted from section 3 (short ≤ 132 chars)
- [ ] Category = Productivity, language set
- [ ] 5 screenshots at 1280×800 + 128×128 icon uploaded
- [ ] Privacy practices tab completed from section 4; policy URL pasted; all 3 certifications ticked
- [ ] Remote code = No
- [ ] Distribution = Public, free
- [ ] `node --test src/common/*.test.mjs` green; all `node --check` pass (they are as of this commit)
- [ ] Manifest version matches the zip name
- [ ] (Only if billing on) all 4 `billing-config.js` fields set and the money path tested in LS test mode

---

## 8. What to expect from review

- **Typical: 1–3 days.** Sometimes up to a week or two, especially for a first
  submission from a new developer account or if the reviewer requests changes.
- The things that most often trigger a rejection are all already handled:
  unused permissions (none — only `storage` + the Reddit host), a missing
  privacy policy URL (step 1), an inaccurate data disclosure (section 4 is
  precise), and "remote code" (none).
- If you get a rejection email, it names the policy clause. Fix, bump the
  version, re-upload, resubmit — the second review is usually faster.
- After approval the listing goes live within a few hours. Search indexing in
  the store takes longer, but store search is not your channel anyway: your
  own Reddit replies are.
