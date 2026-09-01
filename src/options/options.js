/**
 * SubSniper — options.js
 * Manage products/keywords/synonyms/pitch/url · tune the intent lexicon ·
 * set the optional Anthropic key + model · activate a license.
 * Debounced auto-save with a "Saved ✓" indicator.
 */
(function (NS) {
  'use strict';

  const $ = (s) => document.querySelector(s);
  let S = null;           // working copy of settings
  let saveTimer = null;

  function crosshairSvg(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
      'xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" ' +
      'stroke-width="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg>';
  }

  function toList(str) {
    return String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const res = await NS.Storage.setSettings(S);
      if (res && res.ok) flashSaved();
      else flashSaveError(res && res.error);
    }, 400);
  }
  function flashSaved() {
    const el = $('#save-state');
    el.textContent = 'Saved ✓';
    el.classList.remove('err');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1400);
  }
  /**
   * A failed write must never look like a success. chrome.storage can reject a
   * write (quota, serialization, unavailable context) and previously the UI
   * still said "Saved ✓" while the data was discarded.
   */
  function flashSaveError(error) {
    const el = $('#save-state');
    el.textContent = 'Not saved — ' + (error || 'storage error');
    el.classList.add('err', 'show');
    // Leave the failure visible; it must not quietly disappear.
  }

  // ── Products ───────────────────────────────────────────────────────────────
  async function renderProducts() {
    const host = $('#products');
    host.innerHTML = '';
    (S.products || []).forEach((p, i) => host.appendChild(productCard(p, i)));

    // The cap is enforced only when billing is ON and the user is not Pro.
    const n = (S.products || []).length;
    const gate = await NS.License.canAddProduct(n);
    $('#add-product').disabled = !gate.allowed;
    const note = $('#product-limit');
    if (!gate.billing) {
      note.textContent = n + (n === 1 ? ' product tracked' : ' products tracked') + ' · unlimited in v' + NS.VERSION;
    } else if (!Number.isFinite(gate.limit)) {
      note.textContent = n + (n === 1 ? ' product tracked' : ' products tracked') + ' · Pro: unlimited';
    } else {
      note.innerHTML = n + ' of ' + gate.limit + ' on the Free plan · ' +
        '<a href="#" id="pl-upgrade">Upgrade to Pro for unlimited →</a>';
      const up = $('#pl-upgrade');
      if (up) up.addEventListener('click', (e) => { e.preventDefault(); NS.License.startCheckout(); });
    }
  }

  function productCard(p, i) {
    const card = document.createElement('div');
    card.className = 'product';

    const top = document.createElement('div');
    top.className = 'product-top';
    const name = input('text', p.name, 'Product name (e.g. Acme CRM)');
    name.addEventListener('input', () => { p.name = name.value; scheduleSave(); });
    const rm = document.createElement('button');
    rm.className = 'btn-remove'; rm.title = 'Remove product'; rm.textContent = '✕';
    rm.addEventListener('click', () => {
      S.products.splice(i, 1);
      renderProducts(); scheduleSave();
    });
    top.appendChild(name); top.appendChild(rm);
    card.appendChild(top);

    card.appendChild(field('Keywords (required for a match) — comma separated',
      input('text', (p.keywords || []).join(', '), 'crm, lead tracking, sales pipeline', (v) => { p.keywords = toList(v); scheduleSave(); })));
    card.appendChild(field('Synonyms / related terms — comma separated',
      input('text', (p.synonyms || []).join(', '), 'contact manager, pipeline tool', (v) => { p.synonyms = toList(v); scheduleSave(); })));
    card.appendChild(field('One-line pitch (used in drafts)',
      textarea(p.pitch, 'a lightweight CRM that tracks leads without the enterprise bloat', (v) => { p.pitch = v; scheduleSave(); })));
    card.appendChild(field('URL',
      input('text', p.url, 'https://yourproduct.com', (v) => { p.url = v.trim(); scheduleSave(); })));
    return card;
  }

  function input(type, value, ph, onInput) {
    const el = document.createElement('input');
    el.type = type; el.value = value || ''; if (ph) el.placeholder = ph;
    if (onInput) el.addEventListener('input', () => onInput(el.value));
    return el;
  }
  function textarea(value, ph, onInput) {
    const el = document.createElement('textarea');
    el.value = value || ''; if (ph) el.placeholder = ph; el.rows = 2;
    if (onInput) el.addEventListener('input', () => onInput(el.value));
    return el;
  }
  function field(labelText, control) {
    const f = document.createElement('div');
    f.className = 'field';
    const l = document.createElement('label');
    l.textContent = labelText;
    f.appendChild(l); f.appendChild(control);
    return f;
  }

  $('#add-product').addEventListener('click', async () => {
    S.products = S.products || [];
    const gate = await NS.License.canAddProduct(S.products.length);
    if (!gate.allowed) { NS.License.startCheckout(); return; }
    S.products.push({ id: NS.uid('prod'), name: '', keywords: [], synonyms: [], pitch: '', url: '' });
    renderProducts(); scheduleSave();
  });

  // ── Lexicon tuner ──────────────────────────────────────────────────────────
  function currentLexicon() {
    if (Array.isArray(S.intentLexicon) && S.intentLexicon.length) return S.intentLexicon;
    return NS.IntentEngine.cloneDefaultLexicon();
  }

  function renderLexicon() {
    const lex = currentLexicon();
    const pos = $('#lex-positive'); const neg = $('#lex-negative');
    pos.innerHTML = ''; neg.innerHTML = '';
    lex.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'lex-row';
      const label = document.createElement('span');
      label.className = 'lex-label'; label.textContent = entry.label;
      const w = document.createElement('input');
      w.type = 'number'; w.className = 'lex-weight';
      w.min = '0'; w.max = '99'; w.value = String(entry.weight);
      w.addEventListener('input', () => {
        // Materialise a full editable copy the first time the user edits.
        if (!Array.isArray(S.intentLexicon) || !S.intentLexicon.length) {
          S.intentLexicon = NS.IntentEngine.cloneDefaultLexicon();
        }
        const v = Math.max(0, Math.min(99, parseInt(w.value, 10) || 0));
        S.intentLexicon[idx].weight = v;
        scheduleSave();
      });
      row.appendChild(label); row.appendChild(w);
      (entry.kind === 'negative' ? neg : pos).appendChild(row);
    });
  }

  $('#lex-reset').addEventListener('click', () => {
    S.intentLexicon = null;
    renderLexicon(); scheduleSave();
  });

  // ── AI drafts ──────────────────────────────────────────────────────────────
  async function renderAi() {
    const sel = $('#ai-model');
    sel.innerHTML = '';
    NS.MODELS.forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      if (m.id === S.model) o.selected = true;
      sel.appendChild(o);
    });
    // The key is NOT part of settings — it lives alone in chrome.storage.local
    // so it is never synced to Google's servers and never reaches a content
    // script. We show a masked placeholder rather than the value itself.
    const ai = await NS.License.canUseAi();
    const badge = $('#ai-badge');
    badge.textContent = (ai.billing && !ai.allowed) ? 'Pro' : 'Optional';
    badge.classList.toggle('is-pro', ai.billing && !ai.allowed);
    const hasKey = await NS.Storage.hasApiKey();
    const keyEl = $('#ai-key');
    keyEl.value = '';
    keyEl.placeholder = hasKey ? '•••••••••• (saved on this device)' : 'sk-ant-...';
    $('#ai-tone').value = S.draftTone || 'helpful';
    refreshPermNote();
  }

  // Saved on blur (not per keystroke) so we write the key once, to local only.
  $('#ai-key').addEventListener('blur', async (e) => {
    const val = e.target.value.trim();
    if (!val) { refreshPermNote(); return; }
    const res = await NS.Storage.setApiKey(val);
    if (!res.ok) { flashSaveError(res.error); return; }
    e.target.value = '';
    e.target.placeholder = '•••••••••• (saved on this device)';
    flashSaved();
    await ensureAnthropicPermission();
    refreshPermNote();
  });
  $('#ai-model').addEventListener('change', (e) => { S.model = e.target.value; scheduleSave(); });
  $('#ai-tone').addEventListener('change', (e) => { S.draftTone = e.target.value; scheduleSave(); });

  function ensureAnthropicPermission() {
    return new Promise((resolve) => {
      try {
        chrome.permissions.contains({ origins: ['https://api.anthropic.com/*'] }, (has) => {
          if (has) return resolve(true);
          chrome.permissions.request({ origins: ['https://api.anthropic.com/*'] }, (granted) => {
            void chrome.runtime.lastError;
            resolve(!!granted);
          });
        });
      } catch (_e) { resolve(false); }
    });
  }
  async function refreshPermNote() {
    const note = $('#ai-perm-note');
    const ai = await NS.License.canUseAi();
    if (ai.billing && !ai.allowed) {
      note.innerHTML = 'AI drafts are part of <b>Pro</b>. <a href="#" id="ai-upgrade">Upgrade to unlock →</a> ' +
        '(you can still save a key now; it is used once Pro is active).';
      const u = $('#ai-upgrade');
      if (u) u.addEventListener('click', (e) => { e.preventDefault(); NS.License.startCheckout(); });
      return;
    }
    const hasKey = await NS.Storage.hasApiKey();
    if (!hasKey) {
      note.textContent = 'No key set → drafts use built-in local templates (fully offline).';
      return;
    }
    try {
      chrome.permissions.contains({ origins: ['https://api.anthropic.com/*'] }, (has) => {
        note.innerHTML = has
          ? '✓ Ready. AI drafts will call Anthropic directly from your browser.'
          : '⚠ Click <a href="#" id="grant-perm">Enable AI access</a> to allow calls to api.anthropic.com.';
        const g = $('#grant-perm');
        if (g) g.addEventListener('click', async (e) => {
          e.preventDefault(); await ensureAnthropicPermission(); refreshPermNote();
        });
      });
    } catch (_e) { /* ignore */ }
  }

  // ── Plan & license ─────────────────────────────────────────────────────────
  /**
   * When billing is OFF (billing-config.js empty) this states plainly that
   * everything is free — no paywall, nothing to enter.
   * When billing is ON, Pro is granted ONLY from a Lemon Squeezy server
   * verification performed by the background worker (see license.js).
   */
  function ensureLemonPermission() {
    return new Promise((resolve) => {
      try {
        chrome.permissions.contains({ origins: ['https://api.lemonsqueezy.com/*'] }, (has) => {
          if (has) return resolve(true);
          chrome.permissions.request({ origins: ['https://api.lemonsqueezy.com/*'] }, (granted) => {
            void chrome.runtime.lastError;
            resolve(!!granted);
          });
        });
      } catch (_e) { resolve(false); }
    });
  }

  async function renderLicense() {
    const box = $('#license-box');
    box.innerHTML = '';
    const st = await NS.License.getStatus();
    const pill = $('#plan-pill');

    if (!st.billing) {
      const note = document.createElement('p');
      note.className = 'plan-note';
      note.innerHTML =
        '<b>Free — all features unlocked.</b><br>' +
        'v' + NS.VERSION + ' is an early-access build: unlimited products, ' +
        'unlimited saved leads, template drafts, and optional AI drafts with ' +
        'your own Anthropic key. There is no paid tier and nothing to activate.';
      box.appendChild(note);
      $('#plan-blurb').textContent = 'Where SubSniper stands today.';
      pill.textContent = 'Free';
      pill.classList.remove('is-pro');
      return;
    }

    $('#plan-blurb').textContent =
      'Free: ' + NS.LIMITS.FREE_PRODUCTS + ' tracked product + template drafts. ' +
      'Pro: unlimited products + AI drafts. Verified with Lemon Squeezy.';
    pill.textContent = st.pro ? 'Pro' : 'Free';
    pill.classList.toggle('is-pro', st.pro);

    const cache = await NS.Storage.getLicenseCache();
    const statusRow = document.createElement('div');
    statusRow.className = 'license-status';
    const reasonText = {
      'active': 'Pro is active',
      'no-license': 'Free plan',
      'expired': 'Subscription expired — Free plan',
      'disabled': 'License disabled — Free plan',
      'inactive': 'License not activated — Free plan',
      'grace-expired': 'Could not re-verify for 3 days — Free plan until verified',
      'wrong-product': 'That key is for a different product',
      'wrong-store': 'That key is for a different store'
    }[st.reason] || ('Free plan (' + st.reason + ')');
    statusRow.innerHTML =
      '<span class="license-dot ' + (st.pro ? 'on' : '') + '"></span>' +
      '<span class="license-text">' + reasonText + '</span>';
    box.appendChild(statusRow);

    if (cache && cache.validatedAt) {
      const meta = document.createElement('p');
      meta.className = 'license-meta';
      meta.textContent = 'Last verified with Lemon Squeezy: ' + new Date(cache.validatedAt).toLocaleString() +
        (st.stale ? ' · re-checking' : '') +
        (cache.variantId ? ' · variant ' + cache.variantId : '');
      box.appendChild(meta);
    }

    const msg = document.createElement('p');
    msg.className = 'license-msg';

    if (st.pro || (cache && cache.key)) {
      // Has a key on file: offer re-check + deactivate; if not Pro, also allow re-entry.
      const actions = document.createElement('div');
      actions.className = 'license-actions';
      const recheck = document.createElement('button');
      recheck.className = 'btn'; recheck.textContent = 'Re-check now';
      recheck.addEventListener('click', async () => {
        msg.textContent = 'Checking…'; msg.className = 'license-msg';
        const ok = await ensureLemonPermission();
        if (!ok) { msg.textContent = 'Permission for api.lemonsqueezy.com is required to verify.'; msg.className = 'license-msg err'; return; }
        const r = await NS.License.revalidate();
        msg.textContent = r.ok ? (r.pro ? 'Verified — Pro is active.' : 'Verified — not active: ' + (r.status || r.error || 'unknown'))
                               : ('Could not verify: ' + (r.error || 'unknown'));
        msg.className = 'license-msg ' + (r.ok && r.pro ? 'ok' : 'err');
        await renderLicense(); await renderProducts(); await renderAi();
      });
      const deact = document.createElement('button');
      deact.className = 'btn btn-ghost'; deact.textContent = 'Deactivate on this device';
      deact.addEventListener('click', async () => {
        await NS.License.deactivate();
        await renderLicense(); await renderProducts(); await renderAi();
      });
      actions.appendChild(recheck); actions.appendChild(deact);
      box.appendChild(actions);
    }

    if (!st.pro) {
      const row = document.createElement('div');
      row.className = 'license-row';
      const keyInput = document.createElement('input');
      keyInput.type = 'text'; keyInput.placeholder = 'Paste your Lemon Squeezy license key';
      keyInput.autocomplete = 'off'; keyInput.spellcheck = false;
      const activate = document.createElement('button');
      activate.className = 'btn btn-primary'; activate.textContent = 'Activate';
      const buy = document.createElement('button');
      buy.className = 'btn btn-upgrade'; buy.textContent = '✦ Get Pro';
      row.appendChild(keyInput); row.appendChild(activate); row.appendChild(buy);
      box.appendChild(row);

      activate.addEventListener('click', async () => {
        const key = keyInput.value.trim();
        if (!key) { msg.textContent = 'Paste the license key from your Lemon Squeezy receipt.'; msg.className = 'license-msg err'; return; }
        activate.disabled = true; msg.textContent = 'Verifying with Lemon Squeezy…'; msg.className = 'license-msg';
        // Optional host permission — requested here, on a user gesture.
        const ok = await ensureLemonPermission();
        if (!ok) {
          activate.disabled = false;
          msg.textContent = 'SubSniper needs permission to contact api.lemonsqueezy.com to verify your key.';
          msg.className = 'license-msg err';
          return;
        }
        const res = await NS.License.activate(key);
        activate.disabled = false;
        if (res.ok && res.pro) {
          msg.textContent = 'Pro activated. Thank you!'; msg.className = 'license-msg ok';
        } else {
          msg.textContent = res.error || ('Not activated: ' + (res.status || 'unknown')); msg.className = 'license-msg err';
        }
        await renderLicense(); await renderProducts(); await renderAi();
      });
      buy.addEventListener('click', () => NS.License.startCheckout());
    }

    box.appendChild(msg);
  }

  // ── Display ────────────────────────────────────────────────────────────────
  function renderDisplay() {
    const r = $('#min-score');
    r.value = String(S.minScoreToBadge != null ? S.minScoreToBadge : 40);
    $('#min-score-val').textContent = r.value;
    r.addEventListener('input', () => {
      $('#min-score-val').textContent = r.value;
      S.minScoreToBadge = parseInt(r.value, 10) || 0;
      scheduleSave();
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  async function boot() {
    $('#brand-mark').innerHTML = crosshairSvg(24);
    $('#ver').textContent = NS.VERSION;
    S = await NS.Storage.getSettings();
    await renderProducts();
    renderLexicon();
    await renderAi();
    await renderLicense();
    renderDisplay();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(globalThis.SubSniper);
