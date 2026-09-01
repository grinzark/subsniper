/**
 * SubSniper — service-worker.js  (MV3 background)
 * ------------------------------------------------------------------
 * The ONLY place in the extension that makes network requests. It talks to
 * exactly two hosts, both behind OPTIONAL host permissions the user grants
 * on a user gesture in Options:
 *
 *   • https://api.anthropic.com     — the user-initiated AI draft, with the
 *                                     user's OWN key (read from local storage
 *                                     here, never from the caller).
 *   • https://api.lemonsqueezy.com  — Pro license activate/validate/deactivate.
 *                                     Sends only the license key + instance id.
 *
 * guardedFetch() is the single fetch call-site and refuses any other origin.
 * This worker NEVER touches reddit.com — it has no permission for it and no
 * code path that requests it.
 *
 * Shared modules are loaded with importScripts() so the worker uses the same
 * constants / storage / billing-config / license gate as the UI, not copies.
 * ------------------------------------------------------------------
 */
importScripts(
  '/src/common/constants.js',
  '/src/common/storage.js',
  '/src/common/billing-config.js',
  '/src/common/license.js'
);

const NS = globalThis.SubSniper;
const MSG = NS.MSG;

/** The complete allow-list. Nothing else can be fetched, ever. */
const ALLOWED_ORIGINS = Object.freeze([
  'https://api.anthropic.com/',
  NS.BillingConfig.LEMON_API_ORIGIN
]);

function isAllowedUrl(url) {
  return typeof url === 'string' && ALLOWED_ORIGINS.some((o) => url.indexOf(o) === 0);
}

/** The one and only fetch call-site in the extension. */
async function guardedFetch(url, init) {
  if (!isAllowedUrl(url)) {
    throw new Error('Refusing to call a non-allow-listed origin.');
  }
  return fetch(url, init);
}

function hasOriginPermission(originPattern) {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ origins: [originPattern] }, (res) => {
        void chrome.runtime.lastError;
        resolve(!!res);
      });
    } catch (_e) {
      resolve(false);
    }
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    try { chrome.runtime.openOptionsPage(); } catch (_e) { /* ignore */ }
  }
  revalidateIfStale();
});
chrome.runtime.onStartup.addListener(() => { revalidateIfStale(); });

// ── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case MSG.PING:
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return; // sync

    case MSG.OPEN_CHECKOUT: {
      // Only ever the configured checkout URL, and only when billing is on.
      const cfg = NS.BillingConfig.LEMON_SQUEEZY;
      const ok = NS.BillingConfig.isBillingEnabled() &&
        typeof msg.url === 'string' && msg.url === cfg.checkoutUrl;
      if (ok) chrome.tabs.create({ url: cfg.checkoutUrl });
      sendResponse({ ok });
      return; // sync
    }

    case MSG.AI_DRAFT:
      handleAiDraft(msg.request).then(sendResponse);
      return true; // async

    case MSG.LICENSE_ACTIVATE:
      handleLicenseActivate(msg.key).then(sendResponse);
      return true;

    case MSG.LICENSE_VALIDATE:
      handleLicenseValidate().then(sendResponse);
      return true;

    case MSG.LICENSE_DEACTIVATE:
      handleLicenseDeactivate().then(sendResponse);
      return true;

    default:
      return;
  }
});

// ── AI drafts (Anthropic) ────────────────────────────────────────────────────
/**
 * SECURITY MODEL:
 *   1. Verify the URL is Anthropic BEFORE touching the key.
 *   2. Enforce the Pro gate HERE (the trusted context), not only in the UI.
 *   3. Read the key from chrome.storage.local — never trust a caller-supplied
 *      one — and strip any credential headers the caller included.
 */
async function handleAiDraft(request) {
  if (!request || !request.url || !request.body) {
    return { ok: false, error: 'Malformed AI request.' };
  }
  if (request.url.indexOf('https://api.anthropic.com/') !== 0) {
    return { ok: false, error: 'Refusing to call a non-Anthropic URL.' };
  }

  // Pro gate — only restrictive when billing is switched on.
  const gate = await currentLicenseStatus();
  if (gate.billing && !gate.unlocked) {
    return { ok: false, error: 'AI drafts are part of Pro. Upgrade in Options to unlock.' };
  }

  const key = await NS.Storage.getApiKey();
  if (!key) {
    return { ok: false, error: 'No Anthropic API key set. Add one in Options.' };
  }
  if (!(await hasOriginPermission('https://api.anthropic.com/*'))) {
    return {
      ok: false,
      error: 'AI drafting needs permission for api.anthropic.com. Enable it in Options → AI drafts.'
    };
  }

  const headers = Object.assign({}, request.headers || {});
  delete headers['x-api-key'];
  delete headers['authorization'];
  headers['content-type'] = 'application/json';
  headers['x-api-key'] = key;

  try {
    const resp = await guardedFetch(request.url, {
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
    const text = extractAnthropicText(data);
    if (!text) return { ok: false, error: 'Empty response from Anthropic.' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: 'Network error: ' + (e && e.message ? e.message : String(e)) };
  }
}

function extractAnthropicText(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// ── Pro licensing (Lemon Squeezy) ────────────────────────────────────────────
const LEMON_PERMISSION = 'https://api.lemonsqueezy.com/*';

async function currentLicenseStatus() {
  const cache = await NS.Storage.getLicenseCache();
  return NS.License.computeStatus(NS.BillingConfig.LEMON_SQUEEZY, cache, Date.now());
}

/**
 * POST to the Lemon Squeezy License API (public endpoints; no API key).
 * Body is form-encoded, exactly as documented. Returns the parsed JSON, or
 * null if the body wasn't JSON. Throws on network failure.
 */
async function lemonPost(url, params) {
  const resp = await guardedFetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  });
  const data = await resp.json().catch(() => null);
  return { httpStatus: resp.status, data };
}

/**
 * Normalise an activate/validate/deactivate response into one shape.
 * `definitive` is true only when the server gave a real yes/no answer; a
 * non-JSON body or a 5xx is treated as "couldn't verify" (cache untouched).
 */
function normalizeLemon(result, flagField) {
  const data = result && result.data;
  const isServerError = result && result.httpStatus >= 500;
  if (isServerError || !data || typeof data !== 'object' || typeof data[flagField] !== 'boolean') {
    return { definitive: false, ok: false, error: 'Unexpected response from Lemon Squeezy.' };
  }
  const lk = data.license_key || {};
  const meta = data.meta || {};
  const flag = data[flagField] === true;
  return {
    definitive: true,
    ok: flag,
    valid: flag,
    error: data.error || null,
    status: String(lk.status || '').toLowerCase() || (flag ? 'active' : 'invalid'),
    instanceId: data.instance && data.instance.id ? String(data.instance.id) : '',
    productId: meta.product_id != null ? String(meta.product_id) : '',
    storeId: meta.store_id != null ? String(meta.store_id) : '',
    variantId: meta.variant_id != null ? String(meta.variant_id) : ''
    // NOTE: meta.customer_name / customer_email are deliberately NOT kept.
  };
}

/** A key from another product or store is never ours. */
function metaMismatch(norm) {
  const cfg = NS.BillingConfig.LEMON_SQUEEZY;
  if (norm.productId && String(norm.productId) !== String(cfg.productId)) {
    return 'That license key is for a different product.';
  }
  if (norm.storeId && String(norm.storeId) !== String(cfg.storeId)) {
    return 'That license key is for a different store.';
  }
  return null;
}

async function handleLicenseActivate(rawKey) {
  if (!NS.BillingConfig.isBillingEnabled()) {
    return { ok: false, pro: false, error: 'Billing is not enabled in this build.' };
  }
  const key = String(rawKey || '').trim();
  if (!key) return { ok: false, pro: false, error: 'Enter your license key.' };
  if (!(await hasOriginPermission(LEMON_PERMISSION))) {
    return { ok: false, pro: false, error: 'Permission for api.lemonsqueezy.com was not granted.' };
  }

  // Same key already activated on this device → validate instead of burning
  // another activation slot.
  const existing = await NS.Storage.getLicenseCache();
  if (existing && existing.key === key && existing.instanceId) {
    return handleLicenseValidate();
  }

  let result;
  try {
    result = await lemonPost(NS.BillingConfig.LEMON_ACTIVATE_URL, {
      license_key: key,
      instance_name: NS.LICENSE.INSTANCE_NAME
    });
  } catch (e) {
    return { ok: false, pro: false, error: 'Could not reach Lemon Squeezy: ' + (e && e.message ? e.message : String(e)) };
  }
  const norm = normalizeLemon(result, 'activated');
  if (!norm.definitive) return { ok: false, pro: false, error: norm.error };
  if (!norm.ok) {
    return { ok: false, pro: false, status: norm.status, error: norm.error || 'Activation failed.' };
  }
  const mismatch = metaMismatch(norm);
  if (mismatch) return { ok: false, pro: false, error: mismatch };

  const cache = {
    key,
    instanceId: norm.instanceId,
    status: norm.status,
    valid: norm.valid,
    validatedAt: Date.now(),
    productId: norm.productId,
    storeId: norm.storeId,
    variantId: norm.variantId
  };
  const w = await NS.Storage.setLicenseCache(cache);
  if (!w.ok) return { ok: false, pro: false, error: 'Could not save license state: ' + w.error };
  const st = NS.License.computeStatus(NS.BillingConfig.LEMON_SQUEEZY, cache, Date.now());
  return { ok: true, pro: st.pro, status: norm.status, reason: st.reason };
}

async function handleLicenseValidate() {
  if (!NS.BillingConfig.isBillingEnabled()) {
    return { ok: false, pro: false, error: 'Billing is not enabled in this build.' };
  }
  const cache = await NS.Storage.getLicenseCache();
  if (!cache || !cache.key) return { ok: false, pro: false, error: 'No license key on this device.' };
  const before = NS.License.computeStatus(NS.BillingConfig.LEMON_SQUEEZY, cache, Date.now());
  if (!(await hasOriginPermission(LEMON_PERMISSION))) {
    // Can't verify; cached state (and the 3-day grace) stands.
    return { ok: false, pro: before.pro, error: 'Permission for api.lemonsqueezy.com was not granted.' };
  }

  let result;
  try {
    const params = { license_key: cache.key };
    if (cache.instanceId) params.instance_id = cache.instanceId;
    result = await lemonPost(NS.BillingConfig.LEMON_VALIDATE_URL, params);
  } catch (e) {
    // Network failure: leave the cache alone so the grace period applies.
    return { ok: false, pro: before.pro, error: 'Could not reach Lemon Squeezy; using cached state.' };
  }
  const norm = normalizeLemon(result, 'valid');
  if (!norm.definitive) return { ok: false, pro: before.pro, error: norm.error };

  // A definitive answer (valid OR not) refreshes the cache — including an
  // "expired" verdict, which correctly drops the user to Free.
  const next = Object.assign({}, cache, {
    status: norm.status,
    valid: norm.valid,
    validatedAt: Date.now(),
    instanceId: norm.instanceId || cache.instanceId || '',
    productId: norm.productId || cache.productId || '',
    storeId: norm.storeId || cache.storeId || '',
    variantId: norm.variantId || cache.variantId || ''
  });
  await NS.Storage.setLicenseCache(next);
  const st = NS.License.computeStatus(NS.BillingConfig.LEMON_SQUEEZY, next, Date.now());
  return { ok: true, pro: st.pro, status: norm.status, reason: st.reason, error: norm.error };
}

async function handleLicenseDeactivate() {
  const cache = await NS.Storage.getLicenseCache();
  if (cache && cache.key && cache.instanceId && (await hasOriginPermission(LEMON_PERMISSION))) {
    try {
      await lemonPost(NS.BillingConfig.LEMON_DEACTIVATE_URL, {
        license_key: cache.key,
        instance_id: cache.instanceId
      });
    } catch (_e) { /* best-effort: still clear locally */ }
  }
  await NS.Storage.clearLicenseCache();
  return { ok: true, pro: false };
}

/** Background freshness: re-verify once the cached result is >24h old. */
async function revalidateIfStale() {
  try {
    if (!NS.BillingConfig.isBillingEnabled()) return;
    const cache = await NS.Storage.getLicenseCache();
    if (!cache || !cache.key) return;
    const st = NS.License.computeStatus(NS.BillingConfig.LEMON_SQUEEZY, cache, Date.now());
    if (st.stale) await handleLicenseValidate();
  } catch (_e) { /* never let a background check throw */ }
}
