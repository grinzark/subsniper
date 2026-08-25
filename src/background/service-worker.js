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

// v0.1.0 ships free-only: there is no checkout flow (see license.js).
const MSG = {
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

  if (msg.type === MSG.AI_DRAFT) {
    handleAiDraft(msg.request).then(sendResponse);
    return true; // async — keep the message channel open
  }
});

/**
 * Execute the Anthropic Messages API request built by draft.js.
 * Returns { ok, text } or { ok:false, error }.
 *
 * SECURITY MODEL:
 *   1. Verify the URL is Anthropic BEFORE touching the key. The key is only
 *      ever read once we know where it would be sent.
 *   2. Read the key from chrome.storage.local HERE — never trust a key handed
 *      in by the caller. The content script neither holds nor forwards it, so
 *      a compromised page context cannot exfiltrate it via this channel.
 *   3. Strip any caller-supplied auth headers before injecting the real one.
 */
async function handleAiDraft(request) {
  if (!request || !request.url || !request.body) {
    return { ok: false, error: 'Malformed AI request.' };
  }
  if (request.url.indexOf(ANTHROPIC_ORIGIN) !== 0) {
    // Hard guard: this worker only ever talks to Anthropic.
    return { ok: false, error: 'Refusing to call a non-Anthropic URL.' };
  }

  // Origin is verified — now (and only now) read the key from local storage.
  const key = await getApiKey();
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

  // Build headers ourselves; never echo a caller-supplied credential.
  const headers = Object.assign({}, request.headers || {});
  delete headers['x-api-key'];
  delete headers['authorization'];
  headers['content-type'] = 'application/json';
  headers['x-api-key'] = key;

  try {
    const resp = await fetch(request.url, {
      method: 'POST',
      headers: headers,
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

/** Read the Anthropic key from local storage. Background worker only. */
function getApiKey() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('subsniper_api_key', (res) => {
        void chrome.runtime.lastError;
        const k = res && res.subsniper_api_key;
        resolve(typeof k === 'string' ? k.trim() : '');
      });
    } catch (_e) {
      resolve('');
    }
  });
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
