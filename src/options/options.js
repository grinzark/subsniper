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

    // v0.1.0 ships free-only with no caps.
    $('#add-product').disabled = false;
    const n = (S.products || []).length;
    $('#product-limit').textContent =
      n + (n === 1 ? ' product tracked' : ' products tracked') + ' · unlimited in v' + NS.VERSION;
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

  // ── Plan ───────────────────────────────────────────────────────────────────
  /**
   * v0.1.0 ships free-only. There is no key to enter and nothing to buy, so
   * this section states that plainly instead of showing a paywall that could
   * be bypassed by reading the bundle.
   */
  async function renderLicense() {
    const box = $('#license-box');
    box.innerHTML = '';

    const note = document.createElement('p');
    note.className = 'plan-note';
    note.innerHTML =
      '<b>Free — all features unlocked.</b><br>' +
      'v' + NS.VERSION + ' is an early-access build: unlimited products, ' +
      'unlimited saved leads, template drafts, and optional AI drafts with ' +
      'your own Anthropic key. There is no paid tier and nothing to activate.';
    box.appendChild(note);

    const pill = $('#plan-pill');
    pill.textContent = 'Free';
    pill.classList.remove('is-pro');
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
