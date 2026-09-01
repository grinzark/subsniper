# SubSniper — Privacy Policy

_Last updated: 2026-09-01_

**Data controller:** Mohamed Y. (trading as zarkside), sole trader, United Kingdom.
**Publisher (Chrome Web Store "Offered by"):** zarkside.

SubSniper is built privacy-first. The short version: **lead scoring happens on
your device, and SubSniper runs no server of its own.** There are no analytics,
no tracking, and no account. The only things that can ever leave your browser
are (1) an AI draft you explicitly request, sent with your own Anthropic key, and
(2) a Pro license key you choose to activate, sent to Lemon Squeezy for
verification. Both are described below.

## What SubSniper does with data

SubSniper reads the content of **reddit.com pages you are already viewing** in
your own logged-in browser session, in order to score posts and comments for
buying-intent against the products and keywords **you** configure. This
processing happens **entirely locally, in your browser**. Page content is never
uploaded anywhere by default.

## What SubSniper stores (and where)

All storage is Chrome's own extension storage on your device:

- **Roaming preferences** (the on/off toggle, your chosen model, draft tone, and
  badge threshold) are stored in `chrome.storage.sync`. If you're signed into
  Chrome, Chrome may sync these across your own devices; they are not sent to us
  or to any third party.
- **Your products and tuned intent weights** (product names, keywords,
  synonyms, pitch, URL, and signal weights) are stored in
  `chrome.storage.local` — on this machine only, never synced.
- **Your Anthropic API key**, if you choose to enter one, is stored in
  `chrome.storage.local` **only**. It is deliberately kept out of Chrome sync,
  so it is never replicated to Google's servers. It is also never loaded into
  the script that runs on reddit.com — only the extension's background worker
  reads it, and only to authenticate the AI-draft request you explicitly
  trigger.
- **Your Pro license state**, if you activate Pro, is stored in
  `chrome.storage.local` only: the license key, the activation instance id,
  the key's status, and the time it was last verified. We deliberately do
  **not** store your name or email even though Lemon Squeezy's response
  includes them.
- **Saved leads** (the score, matched reasons, snippet, author, subreddit, and
  permalink of leads you explicitly save) and **daily counters** are stored in
  `chrome.storage.local` on this machine only.

You can delete all of it at any time by removing the extension, or by clearing
saved leads in the panel.

## What SubSniper sends over the network

By default: **nothing.** SubSniper makes **no** network requests. It does not
call the Reddit API, does not contact any SubSniper server (there is none), and
does not use analytics.

There are exactly two optional, user-initiated exceptions. The extension's
background worker refuses to contact any other host.

**1. AI drafts — `api.anthropic.com`.** If, and only if, you:
1. enter **your own** Anthropic API key in Options,
2. grant the optional permission for `api.anthropic.com`, and
3. click **"Generate with AI"** on a specific draft,

then SubSniper sends that one lead's text and your product details **directly
from your browser to Anthropic**, authenticated with your own key, to generate
reply text. This request goes to Anthropic and nowhere else. Anthropic's
handling of that request is governed by
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy). If you
never enter a key, this never happens.

**2. Pro license verification — `api.lemonsqueezy.com`.** SubSniper Pro is
sold through Lemon Squeezy, our Merchant of Record. If you buy Pro and activate
your license key in Options (after granting the optional permission for
`api.lemonsqueezy.com`), SubSniper sends **only your license key and an
activation instance id** (plus a fixed label, "SubSniper (Chrome)", on first
activation) to Lemon Squeezy to confirm the subscription is active. It re-checks
about once a day. No page content, products, saved leads, or Anthropic key are
ever included. Your purchase itself — payment details, receipts, name and email
— is handled by Lemon Squeezy under
[Lemon Squeezy's privacy policy](https://www.lemonsqueezy.com/privacy); SubSniper
never sees your payment details. If you never activate a key, this never happens.

## What SubSniper never does

- It never posts, comments, upvotes, messages, or takes **any** action on Reddit
  on your behalf. Drafts are copy-and-paste only; you post manually.
- It never sells, shares, or transmits your data to us or to advertisers.
- It never tracks your browsing outside of scoring the reddit.com page in front
  of you.
- It has no third-party analytics, ad, or tracking SDKs.

## Permissions and why they're needed

- **`storage`** — to save your settings, leads, and license state locally (as
  above).
- **Host access to `*.reddit.com`** — so the content script can read the page
  content it scores. Read-only; no writes.
- **Optional host access to `api.anthropic.com`** — requested only if you enable
  AI drafts, used only for the request described above.
- **Optional host access to `api.lemonsqueezy.com`** — requested only if you
  activate a Pro license, used only for the verification described above.

## Chrome Web Store Limited Use disclosure

SubSniper's use and transfer of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Concretely, that means: the information SubSniper reads is used only to provide
the user-facing lead-scoring and drafting features described above; it is not
sold, not transferred to third parties (except the optional, user-initiated AI
draft sent to Anthropic with the user's own key, and the license key sent to
Lemon Squeezy for verification), not used for advertising or creditworthiness,
and not read by any human.

## Your rights (UK GDPR)

Because SubSniper stores your data on your own device and operates no server, we
hold no personal data about you to access, correct, or erase — removing the
extension removes everything SubSniper stored. For purchase records held by
Lemon Squeezy, contact Lemon Squeezy or use the contact below.

## Contact

zarkside — via the Chrome Web Store listing's support contact.
