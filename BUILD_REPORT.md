# SubSniper — Build Report

**Status: shippable.** A complete, zero-build Manifest V3 Chrome extension that
loads via "Load unpacked" with no toolchain. Built 2026-08-25.

---

## What was built

An in-thread Reddit lead-generation extension that runs **entirely client-side**
on the user's own logged-in reddit.com session. It scores the posts/comments on
the page for buying-intent, shows an inline intent badge on each, provides a
scored saved-leads sidebar, and produces AI-assisted / template reply **drafts**
the user copies and pastes themselves.

### The two guardrails are baked in
1. **Client-side only** — no Reddit API, no scraping backend, no server. The
   content script reads only the DOM of the page the user is already viewing.
   The background worker has host access to `api.anthropic.com` **only** (never
   reddit.com) and refuses any non-Anthropic URL.
2. **Zero auto-posting** — there is no code path that submits, posts, comments,
   or votes on Reddit. The composer outputs to a copy box with a prominent
   **"Copy — paste it yourself"** button and an always-visible disclaimer.

### Feature checklist (all implemented, no stubs in core logic)
- ✅ MV3 manifest, permissions `storage` + `activeTab`, host `*.reddit.com`,
  **optional** host `api.anthropic.com`, background service worker, popup,
  options page, 16/48/128 icons.
- ✅ Shared global namespace (`globalThis.SubSniper`), zero ES-module imports in
  content scripts; ordered injection via manifest `content_scripts.js`.
- ✅ **Intent engine** — pure, deterministic, explainable scorer. Relevance is a
  hard gate (no keyword hit ⇒ not a lead). Weighted buying-intent lexicon +
  negative self-promo signals + question bonus, normalized 0–100, bucketed
  (Hot ≥70 / Warm 40–69 / Cold <40), **returns matched reasons** for the UI.
  User-overridable weights. JSDoc `@typedef`s. **9/9 unit tests pass.**
- ✅ **DOM adapters** for both new Reddit (`shreddit-post` / `shreddit-comment`)
  and old Reddit (`.thing` / `.usertext-body`), de-duplicated, with stable
  node handle + permalink + author + subreddit.
- ✅ **Draft composer** — local template mode (2–3 non-spammy variants, tone
  selector: helpful / concise / founder-to-founder) + optional AI mode that
  **builds** an Anthropic request (default `claude-sonnet-5`,
  `anthropic-version: 2023-06-01`, `x-api-key`,
  `anthropic-dangerous-direct-browser-access`) for the background worker to
  execute. Nothing posts.
- ✅ **License** — free (1 product / 15 leads / templates) vs Pro (unlimited +
  AI). `getStatus()` / `isPro()` / `activate()` / `startCheckout()`. Honest
  local key-check stub (format + checksum) with clearly-marked WIRE-UP notes for
  ExtensionPay and Gumroad.
- ✅ **Content orchestrator** — throttled MutationObserver, SPA-nav aware,
  respects the global on/off toggle, injects clickable intent badges.
- ✅ **Sidebar** — floating toggle + slide-in panel, bucket filters, lead cards
  showing score / WHY / snippet / actions, composer modal, dark/light via
  `prefers-color-scheme`, design tokens, no external assets or fonts.
- ✅ **Popup** — leads-found-today + saved count, master on/off toggle, options
  link, upgrade button.
- ✅ **Options** — manage products/keywords/synonyms/pitch/url, tune every
  intent-signal weight, set Anthropic key + model + tone (with runtime optional
  host-permission request), enter/activate/deactivate license, badge threshold.
- ✅ Distinct Pillow-generated icons (dark rounded-rect, orange crosshair +
  chat-bubble dot) via `assets/generate-icon.py`.
- ✅ `README.md`, `PRIVACY.md`.

---

## File tree

```
SubSniper/
├── manifest.json
├── README.md
├── PRIVACY.md
├── BUILD_REPORT.md
├── assets/
│   ├── generate-icon.py
│   ├── icon.png            (1024 master)
│   ├── icon1024.png
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── common/
    │   ├── constants.js
    │   ├── storage.js
    │   ├── intent-engine.js
    │   ├── intent-engine.test.mjs
    │   ├── dom-reddit.js
    │   ├── draft.js
    │   └── license.js
    ├── content/
    │   ├── content.js
    │   ├── sidebar.js
    │   ├── sidebar.css
    │   └── badges.css
    ├── background/
    │   └── service-worker.js
    ├── popup/
    │   ├── popup.html
    │   ├── popup.js
    │   └── popup.css
    └── options/
        ├── options.html
        ├── options.js
        └── options.css
```
~3,080 lines across src/ (JS/CSS/HTML).

---

## Verification performed

| Check | Result |
|---|---|
| `node --check` on all 10 `.js` files + service worker | **PASS** (all) |
| `node --check` on `intent-engine.test.mjs` | **PASS** |
| `node --test src/common/intent-engine.test.mjs` | **9 pass / 0 fail** |
| `manifest.json` valid JSON | **PASS** |
| Cross-file namespace integration (engine + draft + license) | **PASS** |
| License stub: 200 generated keys all validate; tampered keys rejected | **PASS** |
| Icon generation (`generate-icon.py`) | **PASS** — 16/48/128 + 1024 written |
| TODO/FIXME stubs in core logic | **None** (only WIRE-UP notes in license.js) |
| Visual smoke test of Options page (served over HTTP) | **PASS** — renders, models populated, no console errors |
| Visual smoke test of sidebar + composer (harness) | **PASS** — badges, score rings, WHY chips, copy-paste-only composer + disclaimer all render |

Commands used:
```bash
node --test src/common/intent-engine.test.mjs      # 9/9 pass
python3 assets/generate-icon.py                    # icons regenerated
for f in $(find src -name '*.js'); do node --check "$f"; done
```

### Commands that could not run in the sandbox
- **None failed.** Node v25.3.0 and Python 3.14 + Pillow 12.2 were available, so
  every verification command ran successfully. There was no need for network
  access — nothing in the build fetches dependencies (zero-build, no npm/pip
  install), and the optional Anthropic call is a runtime, user-initiated feature
  that is not exercised at build time.
- The extension could not be loaded into a real Chrome `chrome://extensions`
  environment from here, so the Chrome-only APIs (`chrome.storage`,
  `chrome.permissions`, `chrome.runtime` messaging) were exercised via graceful
  fallbacks and static verification rather than a live extension load. All such
  calls are defensively guarded (`typeof chrome !== 'undefined'`).

---

## What YOU must do (I could not do these for you)

1. **Load it** — `chrome://extensions` → enable Developer mode → **Load
   unpacked** → select the `SubSniper/` folder. (Details in README.)
2. **Configure** — on first install the Options page opens; enter your product,
   keywords, synonyms, pitch, and URL.
3. **Publish to the Chrome Web Store** — register a developer account and pay
   the **one-time $5 fee** to Google (requires your payment method — I cannot do
   this), then zip the folder, upload, fill the listing + privacy practices, and
   click **Submit**. Step-by-step in README → "Publish it".
4. **Wire up Pro billing** — create an **ExtensionPay** (or **Gumroad**) account
   and replace the local license stub with real verification. The exact two code
   spots are marked `WIRE-UP:` in `src/common/license.js`; instructions in
   README → "Wire up the Pro subscription".
5. **(Optional) AI drafts** — these use the end-user's *own* Anthropic API key,
   entered in Options; you don't need to provide one.

---

## Notes / design decisions

- **Default AI model is `claude-sonnet-5`** per the spec (fast + cheap for short
  replies); `claude-opus-5` and `claude-haiku-4-5` are also offered in Options.
- The optional `api.anthropic.com` host permission is declared as
  `optional_host_permissions` and requested at runtime from the Options page
  (a user gesture) only when the user enters a key — most privacy-preserving.
- A bug was caught and fixed during verification: the license checksum used a
  signed right-shift (`>> 5`) that produced `undefined` for large unsigned sums;
  changed to unsigned (`>>> 5`). All 200 sample keys now validate.
- No `git` was run; everything lives under `/Users/mohamedy/SubSniper`.
