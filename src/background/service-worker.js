/**
 * SubSniper — service-worker.js  (MV3 background)
 * ------------------------------------------------------------------
 * Handles exactly two things:
 *   1. Opening the checkout URL in a new tab (upgrade to Pro).
 *   2. Executing the OPTIONAL, user-initiated Anthropic draft request and
 *      returning the text to the content script.
 *
 * It NEVER touches reddit.com. It has no host permission for reddit and makes
 * no request to it. The only network call it can make is to api.anthropic.com,
 * and only when the user has granted that optional host permission and clicked
 * "Generate with AI" with their own key.
 * ------------------------------------------------------------------
 */

const MSG = {
  OPEN_CHECKOUT: 'subsniper:open-checkout',
  AI_DRAFT: 'subsniper:ai-draft',
  PING: 'subsniper:ping'
};

const ANTHROPIC_ORIGIN = 'https://api.anthropic.com/';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open Options on first install so the user sets up their product/keywords.
    try { chrome.runtime.openOptionsPage(); } catch (_e) { /* ignore */ }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === MSG.PING) {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return; // sync
  }

  if (msg.type === MSG.OPEN_CHECKOUT) {
    const url = typeof msg.url === 'string' && /^https:\/\//.test(msg.url)
      ? msg.url : null;
    if (url) chrome.tabs.create({ url });
    sendResponse({ ok: !!url });
    return; // sync
  }

  if (msg.type === MSG.AI_DRAFT) {
    handleAiDraft(msg.request).then(sendResponse);
    return true; // async — keep the message channel open
  }
});

/**
 * Execute the Anthropic Messages API request built by draft.js.
 * Returns { ok, text } or { ok:false, error }.
 */
async function handleAiDraft(request) {
  if (!request || !request.url || !request.body) {
    return { ok: false, error: 'Malformed AI request.' };
  }
  if (request.url.indexOf(ANTHROPIC_ORIGIN) !== 0) {
    // Hard guard: this worker only ever talks to Anthropic.
    return { ok: false, error: 'Refusing to call a non-Anthropic URL.' };
  }
  const key = request.headers && request.headers['x-api-key'];
  if (!key) {
    return { ok: false, error: 'No Anthropic API key set. Add one in Options.' };
  }

  // Ensure the optional host permission was granted (requested from Options).
  const granted = await hasAnthropicPermission();
  if (!granted) {
    return {
      ok: false,
      error: 'AI drafting needs permission for api.anthropic.com. Enable it in Options → AI drafts.'
    };
  }

  try {
    const resp = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body)
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const detail = data && data.error && data.error.message
        ? data.error.message : ('HTTP ' + resp.status);
      return { ok: false, error: 'Anthropic API: ' + detail };
    }
    const text = extractText(data);
    if (!text) return { ok: false, error: 'Empty response from Anthropic.' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: 'Network error: ' + (e && e.message ? e.message : String(e)) };
  }
}

function extractText(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function hasAnthropicPermission() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains(
        { origins: ['https://api.anthropic.com/*'] },
        (res) => { void chrome.runtime.lastError; resolve(!!res); }
      );
    } catch (_e) {
      resolve(false);
    }
  });
}
