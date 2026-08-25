# SubSniper — Privacy Policy

_Last updated: 2026-08-25_

SubSniper is built privacy-first. The short version: **your data stays on your
device.** SubSniper has no server, no analytics, no tracking, and no account.

## What SubSniper does with data

SubSniper reads the content of **reddit.com pages you are already viewing** in
your own logged-in browser session, in order to score posts and comments for
buying-intent against the products and keywords **you** configure. This
processing happens **entirely locally, in your browser**. The page content is
never uploaded anywhere.

## What SubSniper stores (and where)

All storage is Chrome's own extension storage on your device:

- **Settings** (your products, keywords, synonyms, pitch, URL, intent-signal
  weights, display preferences, license state, and — if you choose to enter one
  — your Anthropic API key and chosen model) are stored in
  `chrome.storage.sync`. If you're signed into Chrome, Chrome may sync these
  across your own devices; they are not sent to us or to any third party.
- **Saved leads** (the score, matched reasons, snippet, author, subreddit, and
  permalink of leads you explicitly save) and **daily counters** are stored in
  `chrome.storage.local` on this machine only.

You can delete all of it at any time by removing the extension, or by clearing
saved leads in the panel.

## What SubSniper sends over the network

By default: **nothing.** SubSniper makes **no** network requests. It does not
call the Reddit API, does not contact any SubSniper server (there is none), and
does not use analytics.

**One optional exception — AI drafts.** If, and only if, you:
1. enter **your own** Anthropic API key in Options,
2. grant the optional permission for `api.anthropic.com`, and
3. click **"Generate with AI"** on a specific draft,

then SubSniper sends that one lead's text and your product details **directly
from your browser to Anthropic** (`https://api.anthropic.com`), authenticated
with your own key, to generate reply text. This request goes to Anthropic and
nowhere else. Anthropic's handling of that request is governed by
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy). If you
never enter a key, this never happens.

## What SubSniper never does

- It never posts, comments, upvotes, messages, or takes **any** action on Reddit
  on your behalf. Drafts are copy-and-paste only; you post manually.
- It never sells, shares, or transmits your data to us or to advertisers.
- It never tracks your browsing outside of scoring the reddit.com page in front
  of you.
- It has no third-party analytics, ad, or tracking SDKs.

## Permissions and why they're needed

- **`storage`** — to save your settings and leads locally (as above).
- **`activeTab`** — to operate on the Reddit tab you're actively using.
- **Host access to `*.reddit.com`** — so the content script can read the page
  content it scores. Read-only; no writes.
- **Optional host access to `api.anthropic.com`** — requested only if you enable
  AI drafts, used only for the request described above.

## Contact

Questions about this policy can be directed to the developer via the Chrome Web
Store listing's support contact.
