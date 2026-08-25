/**
 * SubSniper — sidebar.js
 * ------------------------------------------------------------------
 * The floating toggle + slide-in panel + composer modal.
 *
 * Renders the leads found on THIS page (passed in from content.js), sorted by
 * score, filterable by bucket. Each card shows the score, WHY it scored
 * (matched reasons), a snippet, and actions: Save · Draft reply · Open thread.
 *
 * The "Draft reply" composer produces copy-paste-only text with a prominent
 * "Copy — paste it yourself" button and the manual-post disclaimer. There is
 * NO submit-to-Reddit path anywhere in this file.
 *
 * No shadow DOM: styles ship as content-script CSS (badges.css / sidebar.css)
 * scoped under #subsniper-root.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  // Tiny hyperscript helper.
  function h(tag, props, children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'class') el.className = props[k];
        else if (k === 'text') el.textContent = props[k];
        else if (k === 'html') el.innerHTML = props[k];
        else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else if (k === 'dataset') {
          Object.assign(el.dataset, props[k]);
        } else if (props[k] != null) {
          el.setAttribute(k, props[k]);
        }
      }
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function copyText(text) {
    // Prefer the async clipboard API (works on user gesture in content scripts).
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0;' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (_e) { return false; }
  }

  const Sidebar = {
    _root: null,
    _panel: null,
    _list: null,
    _fab: null,
    _countEl: null,
    _modal: null,
    _state: { leads: [], filter: 'all', settings: null, open: false },
    _mounted: false,
    _onChange: null,

    /** @param {Object} opts { onChange } */
    init(opts) {
      if (this._mounted) return;
      this._onChange = (opts && opts.onChange) || null;
      this._buildShell();
      this._mounted = true;
    },

    _buildShell() {
      const root = h('div', { id: 'subsniper-root' });

      // Floating action button.
      const count = h('span', { class: 'ss-fab-count', text: '0' });
      this._countEl = count;
      const fab = h('button', {
        class: 'ss-fab', title: 'SubSniper — leads on this page',
        'aria-label': 'Open SubSniper',
        onClick: () => this.toggle()
      }, [
        h('span', { class: 'ss-fab-mark', html: crosshairSvg() }),
        count
      ]);
      this._fab = fab;

      // Panel.
      const title = h('div', { class: 'ss-brand' }, [
        h('span', { class: 'ss-brand-mark', html: crosshairSvg() }),
        h('span', { class: 'ss-brand-name', text: 'SubSniper' })
      ]);
      const closeBtn = h('button', {
        class: 'ss-icon-btn', title: 'Close', 'aria-label': 'Close panel',
        text: '✕', onClick: () => this.close()
      });
      const head = h('div', { class: 'ss-head' }, [title, closeBtn]);

      const filters = h('div', { class: 'ss-filters' },
        [['all', 'All'], ['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold']].map(([val, label]) =>
          h('button', {
            class: 'ss-chip ss-filter' + (this._state.filter === val ? ' is-active' : ''),
            dataset: { filter: val },
            text: label,
            onClick: (e) => this._setFilter(e.currentTarget.dataset.filter)
          })
        )
      );

      const list = h('div', { class: 'ss-list' });
      this._list = list;

      const foot = h('div', { class: 'ss-foot' }, [
        h('span', { class: 'ss-foot-note', text: 'Reads this page only · never posts for you' })
      ]);
      this._foot = foot;

      const panel = h('aside', { class: 'ss-panel', role: 'complementary' }, [head, filters, list, foot]);
      this._panel = panel;

      // Composer modal (hidden until used).
      const modal = h('div', { class: 'ss-modal-backdrop', onClick: (e) => {
        if (e.target === modal) this.closeComposer();
      } });
      this._modal = modal;

      root.appendChild(fab);
      root.appendChild(panel);
      root.appendChild(modal);
      (document.body || document.documentElement).appendChild(root);
      this._root = root;
    },

    _setFilter(f) {
      this._state.filter = f;
      this._panel.querySelectorAll('.ss-filter').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.filter === f);
      });
      this._renderList();
    },

    /** Update the leads shown + current settings. Called by content.js. */
    update(leads, settings) {
      this._state.leads = Array.isArray(leads) ? leads.slice() : [];
      if (settings) this._state.settings = settings;
      const n = this._state.leads.length;
      this._countEl.textContent = String(n);
      this._fab.classList.toggle('has-leads', n > 0);
      // Reflect the hottest bucket on the FAB.
      const hasHot = this._state.leads.some((l) => l.bucket === 'hot');
      const hasWarm = this._state.leads.some((l) => l.bucket === 'warm');
      this._fab.dataset.temp = hasHot ? 'hot' : (hasWarm ? 'warm' : 'cold');
      if (this._state.open) this._renderList();
    },

    _visibleLeads() {
      const f = this._state.filter;
      let leads = this._state.leads.slice();
      if (f !== 'all') leads = leads.filter((l) => l.bucket === f);
      leads.sort((a, b) => b.score - a.score);
      return leads;
    },

    _renderList() {
      const list = this._list;
      list.innerHTML = '';
      const leads = this._visibleLeads();
      if (!leads.length) {
        list.appendChild(h('div', { class: 'ss-empty' }, [
          h('div', { class: 'ss-empty-mark', html: crosshairSvg() }),
          h('p', { class: 'ss-empty-title', text: this._state.leads.length ? 'No leads in this filter' : 'No leads spotted yet' }),
          h('p', { class: 'ss-empty-sub', text: this._state.leads.length
            ? 'Try the “All” filter.'
            : 'Scroll the thread, or open a subreddit search for your keywords. Matches show up here.' })
        ]));
        return;
      }
      leads.forEach((lead) => list.appendChild(this._card(lead)));
    },

    _card(lead) {
      const meta = NS.BUCKET_META[lead.bucket] || NS.BUCKET_META.cold;
      const scoreRing = h('div', { class: 'ss-score', dataset: { bucket: lead.bucket } }, [
        h('span', { class: 'ss-score-num', text: String(lead.score) }),
        h('span', { class: 'ss-score-lbl', text: meta.label })
      ]);

      const metaRow = h('div', { class: 'ss-card-meta' }, [
        h('span', { class: 'ss-tag', text: (lead.type === 'comment' ? 'comment' : 'post') }),
        lead.subreddit ? h('span', { class: 'ss-tag ss-tag-sub', text: 'r/' + lead.subreddit }) : null,
        lead.author ? h('span', { class: 'ss-muted', text: 'u/' + lead.author }) : null
      ]);

      const why = h('div', { class: 'ss-why' },
        (lead.reasons || []).slice(0, 5).map((r) =>
          h('span', {
            class: 'ss-reason ' + (r.weight < 0 ? 'is-neg' : (r.type === 'relevance' ? 'is-rel' : 'is-pos')),
            title: r.match ? ('matched: “' + r.match + '”') : r.label
          }, [
            h('span', { class: 'ss-reason-lbl', text: r.label }),
            h('span', { class: 'ss-reason-w', text: (r.weight > 0 ? '+' : '') + r.weight })
          ])
        )
      );

      const snippet = h('p', { class: 'ss-snippet', text: truncate(lead.snippet || lead.text || '', 240) });

      const saveBtn = h('button', {
        class: 'ss-btn ss-btn-save' + (lead.saved ? ' is-saved' : ''),
        text: lead.saved ? '✓ Saved' : 'Save lead',
        onClick: (e) => this._onSave(lead, e.currentTarget)
      });
      const draftBtn = h('button', {
        class: 'ss-btn ss-btn-draft', text: 'Draft reply',
        onClick: () => this.openComposer(lead)
      });
      const openBtn = h('button', {
        class: 'ss-btn ss-btn-ghost', text: 'Open ↗',
        onClick: () => { if (lead.permalink) window.open(lead.permalink, '_blank', 'noopener'); }
      });
      const actions = h('div', { class: 'ss-card-actions' }, [saveBtn, draftBtn, openBtn]);

      return h('div', { class: 'ss-card', dataset: { bucket: lead.bucket, id: lead.id } }, [
        h('div', { class: 'ss-card-top' }, [scoreRing, h('div', { class: 'ss-card-headings' }, [metaRow, why]) ]),
        snippet,
        actions
      ]);
    },

    async _onSave(lead, btn) {
      const record = toLeadRecord(lead);
      const res = await NS.Storage.saveLead(record);
      if (!res.ok && res.reason === 'free-limit') {
        this._toast('Free plan saves ' + NS.LIMITS.FREE_LEADS + ' leads. Upgrade to Pro for unlimited.', 'upgrade');
        return;
      }
      lead.saved = true;
      if (btn) { btn.textContent = '✓ Saved'; btn.classList.add('is-saved'); }
      this._toast('Lead saved', 'ok');
      if (this._onChange) this._onChange();
    },

    // ── Composer ────────────────────────────────────────────────────────────
    openComposer(lead) {
      const settings = this._state.settings || NS.defaultSettings();
      const product = lead.product ||
        (settings.products || []).find((p) => p.id === lead.productId) ||
        (settings.products || [])[0] || { name: 'my product' };
      const tone = settings.draftTone || 'helpful';

      const toneSel = h('div', { class: 'ss-tones' },
        NS.TONES.map((t) =>
          h('button', {
            class: 'ss-chip ss-tone' + (t === tone ? ' is-active' : ''),
            dataset: { tone: t }, text: toneLabel(t),
            onClick: (e) => this._renderVariants(lead, product, e.currentTarget.dataset.tone)
          })
        )
      );

      const variantsWrap = h('div', { class: 'ss-variants' });
      this._variantsWrap = variantsWrap;

      const disclaimer = h('div', { class: 'ss-disclaimer' }, [
        h('span', { class: 'ss-disclaimer-icon', text: '✋' }),
        h('span', { text: NS.Draft.MANUAL_POST_NOTICE })
      ]);

      const aiRow = this._aiRow(lead, product, settings);

      const modalCard = h('div', { class: 'ss-modal' }, [
        h('div', { class: 'ss-modal-head' }, [
          h('div', { class: 'ss-modal-title', text: 'Draft a reply' }),
          h('button', { class: 'ss-icon-btn', text: '✕', title: 'Close', onClick: () => this.closeComposer() })
        ]),
        h('div', { class: 'ss-modal-context' }, [
          h('span', { class: 'ss-tag', text: (lead.type === 'comment' ? 'comment' : 'post') }),
          lead.subreddit ? h('span', { class: 'ss-tag ss-tag-sub', text: 'r/' + lead.subreddit }) : null,
          h('span', { class: 'ss-muted', text: truncate(lead.snippet || lead.text || '', 120) })
        ]),
        h('div', { class: 'ss-modal-label', text: 'Tone' }),
        toneSel,
        aiRow,
        disclaimer,
        variantsWrap
      ]);

      this._modal.innerHTML = '';
      this._modal.appendChild(modalCard);
      this._modal.classList.add('is-open');
      this._renderVariants(lead, product, tone);
    },

    _aiRow(lead, product, settings) {
      const hasKey = !!(settings.anthropicKey && settings.anthropicKey.trim());
      const isPro = !!(settings.license && settings.license.pro);
      const btn = h('button', {
        class: 'ss-btn ss-btn-ai',
        text: '✨ Generate with AI',
        onClick: async (e) => {
          const b = e.currentTarget;
          if (!isPro) { this._toast('AI drafts are a Pro feature. Upgrade to unlock.', 'upgrade'); return; }
          if (!hasKey) { this._toast('Add your Anthropic API key in Options to use AI drafts.', 'info'); return; }
          b.disabled = true; b.textContent = '✨ Generating…';
          const request = NS.Draft.buildAiRequest(lead, product, settings);
          const out = await sendAiDraft(request);
          b.disabled = false; b.textContent = '✨ Generate with AI';
          if (!out.ok) { this._toast(out.error || 'AI draft failed.', 'info'); return; }
          this._prependVariant({ label: 'AI draft', text: out.text }, lead, product);
        }
      });
      const note = h('span', { class: 'ss-ai-note', text: isPro
        ? (hasKey ? 'Uses your Anthropic key · ' + (settings.model || 'claude-sonnet-5') : 'Add your API key in Options')
        : 'Pro feature' });
      return h('div', { class: 'ss-ai-row' }, [btn, note]);
    },

    _renderVariants(lead, product, tone) {
      this._modal.querySelectorAll('.ss-tone').forEach((b) =>
        b.classList.toggle('is-active', b.dataset.tone === tone));
      const { variants } = NS.Draft.buildLocalDrafts(toLeadRecord(lead), product, tone);
      this._variantsWrap.innerHTML = '';
      variants.forEach((v) => this._variantsWrap.appendChild(this._variantCard(v)));
    },

    _prependVariant(variant, lead, product) {
      this._variantsWrap.insertBefore(this._variantCard(variant, true), this._variantsWrap.firstChild);
    },

    _variantCard(variant, isAi) {
      const box = h('textarea', { class: 'ss-variant-text', rows: '7', spellcheck: 'true' });
      box.value = variant.text;
      const copyBtn = h('button', {
        class: 'ss-btn ss-btn-copy',
        text: 'Copy — paste it yourself',
        onClick: async (e) => {
          await copyText(box.value);
          const b = e.currentTarget;
          const prev = b.textContent;
          b.textContent = '✓ Copied — now paste it into Reddit';
          b.classList.add('is-copied');
          setTimeout(() => { b.textContent = prev; b.classList.remove('is-copied'); }, 2200);
        }
      });
      return h('div', { class: 'ss-variant' + (isAi ? ' is-ai' : '') }, [
        h('div', { class: 'ss-variant-head' }, [
          h('span', { class: 'ss-variant-label', text: variant.label }),
          h('span', { class: 'ss-variant-hint', text: 'editable — make it sound like you' })
        ]),
        box,
        copyBtn
      ]);
    },

    closeComposer() {
      this._modal.classList.remove('is-open');
      this._modal.innerHTML = '';
    },

    // ── Panel open/close ─────────────────────────────────────────────────────
    open(leadId) {
      this._state.open = true;
      this._root.classList.add('is-open');
      this._renderList();
      if (leadId) {
        // Ensure the target lead is visible under the current filter.
        const inFilter = this._visibleLeads().some((l) => l.id === leadId);
        if (!inFilter) this._setFilter('all');
        requestAnimationFrame(() => {
          const card = this._list.querySelector('.ss-card[data-id="' + cssEscape(leadId) + '"]');
          if (card) {
            card.scrollIntoView({ block: 'center', behavior: 'smooth' });
            card.classList.add('is-flash');
            setTimeout(() => card.classList.remove('is-flash'), 1400);
          }
        });
      }
    },
    close() { this._state.open = false; this._root.classList.remove('is-open'); },
    toggle() { this._state.open ? this.close() : this.open(); },

    setVisible(visible) {
      if (!this._root) return;
      this._root.style.display = visible ? '' : 'none';
      if (!visible) this.close();
    },

    _toast(msg, kind) {
      const t = h('div', { class: 'ss-toast ss-toast-' + (kind || 'ok') }, [
        h('span', { text: msg }),
        kind === 'upgrade' ? h('button', {
          class: 'ss-toast-cta', text: 'Upgrade',
          onClick: () => NS.License.startCheckout()
        }) : null
      ]);
      this._root.appendChild(t);
      requestAnimationFrame(() => t.classList.add('is-in'));
      setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, kind === 'upgrade' ? 5000 : 2400);
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function toneLabel(t) {
    return t === 'founder-to-founder' ? 'Founder-to-founder'
      : t.charAt(0).toUpperCase() + t.slice(1);
  }
  function cssEscape(s) {
    return String(s).replace(/["\\\]]/g, '\\$&');
  }
  function toLeadRecord(lead) {
    return {
      id: lead.id,
      score: lead.score,
      bucket: lead.bucket,
      reasons: lead.reasons || [],
      author: lead.author || '',
      subreddit: lead.subreddit || '',
      permalink: lead.permalink || '',
      snippet: truncate(lead.snippet || lead.text || '', 400),
      text: lead.text || '',
      type: lead.type || 'post',
      productId: (lead.product && lead.product.id) || lead.productId || '',
      savedAt: Date.now(),
      dismissed: false
    };
  }
  function sendAiDraft(request) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: NS.MSG.AI_DRAFT, request }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { ok: false, error: 'No response from background.' });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }
  function crosshairSvg() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg>';
  }

  NS.Sidebar = Sidebar;
})(globalThis.SubSniper);
