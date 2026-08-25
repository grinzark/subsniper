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
      await NS.Storage.setSettings(S);
      flashSaved();
    }, 400);
  }
  function flashSaved() {
    const el = $('#save-state');
    el.textContent = 'Saved ✓';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1400);
  }

  // ── Products ───────────────────────────────────────────────────────────────
  async function renderProducts() {
    const host = $('#products');
    host.innerHTML = '';
    (S.products || []).forEach((p, i) => host.appendChild(productCard(p, i)));

    const status = await NS.License.getStatus();
    const canAdd = status.pro || (S.products || []).length < NS.LIMITS.FREE_PRODUCTS;
    $('#add-product').disabled = !canAdd;
    $('#product-limit').innerHTML = status.pro
      ? 'Pro: unlimited products.'
      : (S.products || []).length + ' of ' + NS.LIMITS.FREE_PRODUCTS +
        ' products used on the Free plan. <a href="#" id="pl-upgrade">Upgrade for unlimited →</a>';
    const up = $('#pl-upgrade');
    if (up) up.addEventListener('click', (e) => { e.preventDefault(); NS.License.startCheckout(); });
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
    const status = await NS.License.getStatus();
    if (!status.pro && (S.products || []).length >= NS.LIMITS.FREE_PRODUCTS) {
      NS.License.startCheckout();
      return;
    }
    S.products = S.products || [];
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
  function renderAi() {
    const sel = $('#ai-model');
    sel.innerHTML = '';
    NS.MODELS.forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      if (m.id === S.model) o.selected = true;
      sel.appendChild(o);
    });
    $('#ai-key').value = S.anthropicKey || '';
    $('#ai-tone').value = S.draftTone || 'helpful';
    refreshPermNote();
  }

  $('#ai-key').addEventListener('input', (e) => {
    S.anthropicKey = e.target.value.trim();
    scheduleSave();
    // When a key is present, request the optional host permission so AI drafts
    // can actually run. Must be from a user gesture — input counts on save click,
    // but to be safe we request on blur too.
  });
  $('#ai-key').addEventListener('blur', async () => {
    if (S.anthropicKey) await ensureAnthropicPermission();
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
  function refreshPermNote() {
    const note = $('#ai-perm-note');
    if (!S.anthropicKey) {
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

  // ── License ────────────────────────────────────────────────────────────────
  async function renderLicense() {
    const box = $('#license-box');
    box.innerHTML = '';
    const status = await NS.License.getStatus();

    const statusRow = document.createElement('div');
    statusRow.className = 'license-status';
    statusRow.innerHTML =
      '<span class="license-dot ' + (status.pro ? 'on' : '') + '"></span>' +
      '<span class="license-text">' + (status.pro ? 'Pro is active' : 'Free plan') + '</span>';
    box.appendChild(statusRow);

    // Plan pill in masthead.
    const pill = $('#plan-pill');
    pill.textContent = status.pro ? 'Pro' : 'Free';
    pill.classList.toggle('is-pro', status.pro);

    if (status.pro) {
      const deact = document.createElement('button');
      deact.className = 'btn btn-ghost'; deact.textContent = 'Deactivate Pro on this device';
      deact.addEventListener('click', async () => {
        await NS.License.deactivate();
        renderLicense(); renderProducts();
      });
      box.appendChild(deact);
      return;
    }

    const row = document.createElement('div');
    row.className = 'license-row';
    const keyInput = document.createElement('input');
    keyInput.type = 'text'; keyInput.placeholder = 'SUBSNIPER-PRO-XXXX-XXXX-XX';
    const activate = document.createElement('button');
    activate.className = 'btn btn-primary'; activate.textContent = 'Activate';
    const buy = document.createElement('button');
    buy.className = 'btn btn-upgrade'; buy.textContent = '✦ Get Pro';
    row.appendChild(keyInput); row.appendChild(activate); row.appendChild(buy);
    box.appendChild(row);

    const msg = document.createElement('p');
    msg.className = 'license-msg';
    box.appendChild(msg);

    activate.addEventListener('click', async () => {
      const res = await NS.License.activate(keyInput.value);
      if (res.ok) {
        msg.textContent = 'Pro activated. Enjoy!'; msg.className = 'license-msg ok';
        S = await NS.Storage.getSettings();
        renderLicense(); renderProducts(); renderAi();
      } else {
        msg.textContent = res.error || 'Activation failed.'; msg.className = 'license-msg err';
      }
    });
    buy.addEventListener('click', () => NS.License.startCheckout());
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
    renderAi();
    await renderLicense();
    renderDisplay();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(globalThis.SubSniper);
