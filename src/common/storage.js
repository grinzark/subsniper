/**
 * SubSniper — storage.js
 * ------------------------------------------------------------------
 * Thin async wrapper over chrome.storage.
 *
 *   settings (roaming) → chrome.storage.sync   enabled, model, tone, threshold
 *   settings (bulk)    → chrome.storage.local  products, intentLexicon
 *   API key            → chrome.storage.local  ALONE, under its own key
 *   leads / stats      → chrome.storage.local
 *
 * WHY THE SPLIT:
 *  • chrome.storage.sync has an 8KB PER-ITEM quota. Writing over it fails and,
 *    with a callback that ignores chrome.runtime.lastError, fails *silently* —
 *    the UI says "Saved ✓" while the data is discarded. products and
 *    intentLexicon are unbounded, so they live in local.
 *  • The Anthropic API key must never be replicated to Google's sync servers
 *    and must never be loaded into a content script running on reddit.com.
 *    It is stored alone in local and read ONLY by the background worker.
 *
 * Every write returns { ok, error } — callers must surface failures.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const KEYS = NS.KEYS;

  function hasChrome() {
    return typeof chrome !== 'undefined' && chrome.storage;
  }

  function areaGet(area, key) {
    return new Promise((resolve) => {
      if (!hasChrome()) return resolve(undefined);
      try {
        chrome.storage[area].get(key, (res) => {
          // Read errors are non-fatal: fall back to defaults.
          void chrome.runtime.lastError;
          resolve(res ? res[key] : undefined);
        });
      } catch (_e) {
        resolve(undefined);
      }
    });
  }

  /**
   * Write one item. NEVER swallows the error — quota overruns and other
   * failures are reported so the UI can show a real failure state.
   * @returns {Promise<{ok:boolean, error?:string}>}
   */
  function areaSet(area, key, value) {
    return new Promise((resolve) => {
      if (!hasChrome()) return resolve({ ok: false, error: 'storage unavailable' });
      try {
        chrome.storage[area].set({ [key]: value }, () => {
          const err = chrome.runtime.lastError;
          resolve(err ? { ok: false, error: err.message } : { ok: true });
        });
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  function areaRemove(area, key) {
    return new Promise((resolve) => {
      if (!hasChrome()) return resolve({ ok: false, error: 'storage unavailable' });
      try {
        chrome.storage[area].remove(key, () => {
          const err = chrome.runtime.lastError;
          resolve(err ? { ok: false, error: err.message } : { ok: true });
        });
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  /** Merge stored settings over the defaults so upgrades always have values. */
  function mergeSettings(syncPart, localPart) {
    const base = NS.defaultSettings();
    const out = Object.assign({}, base, syncPart || {}, localPart || {});
    out.license = Object.assign({}, base.license, (syncPart && syncPart.license) || {});
    if (!Array.isArray(out.products)) out.products = base.products;
    // The key must never ride along inside the settings object.
    delete out.anthropicKey;
    return out;
  }

  /** Split a settings object into its sync half and its local half. */
  function splitSettings(settings) {
    const localFields = NS.LOCAL_SETTING_FIELDS;
    const syncPart = {};
    const localPart = {};
    Object.keys(settings || {}).forEach((k) => {
      if (k === 'anthropicKey') return;         // never persisted here
      if (localFields.indexOf(k) !== -1) localPart[k] = settings[k];
      else syncPart[k] = settings[k];
    });
    return { syncPart, localPart };
  }

  const Storage = {
    /** @returns {Promise<Object>} full settings (sync + local merged). */
    async getSettings() {
      const [syncPart, localPart] = await Promise.all([
        areaGet('sync', KEYS.SETTINGS),
        areaGet('local', KEYS.SETTINGS_LOCAL)
      ]);
      return mergeSettings(syncPart, localPart);
    },

    /**
     * Persist settings across both areas.
     * @returns {Promise<{ok:boolean, error?:string}>} honest result.
     */
    async setSettings(settings) {
      const { syncPart, localPart } = splitSettings(settings);
      const [a, b] = await Promise.all([
        areaSet('sync', KEYS.SETTINGS, syncPart),
        areaSet('local', KEYS.SETTINGS_LOCAL, localPart)
      ]);
      if (!a.ok) return a;
      if (!b.ok) return b;
      return { ok: true };
    },

    /** Patch a subset of settings and persist. @returns {Promise<{ok,error,settings}>} */
    async updateSettings(patch) {
      const cur = await this.getSettings();
      const next = Object.assign({}, cur, patch);
      const res = await this.setSettings(next);
      return Object.assign({}, res, { settings: next });
    },

    // ── Anthropic API key: local only, isolated, never in settings ──────────
    /** Read the key. Called ONLY by the background service worker. */
    async getApiKey() {
      const k = await areaGet('local', KEYS.API_KEY);
      return typeof k === 'string' ? k : '';
    },

    /** @returns {Promise<{ok:boolean, error?:string}>} */
    async setApiKey(key) {
      const clean = (key || '').trim();
      if (!clean) return areaRemove('local', KEYS.API_KEY);
      return areaSet('local', KEYS.API_KEY, clean);
    },

    /**
     * Whether a key is configured — returns a BOOLEAN only.
     * Safe to call from a content script: the key itself never crosses over.
     */
    async hasApiKey() {
      const k = await areaGet('local', KEYS.API_KEY);
      return !!(k && String(k).trim());
    },

    /** @returns {Promise<Array>} saved leads (never null). */
    async getLeads() {
      const raw = await areaGet('local', KEYS.LEADS);
      return Array.isArray(raw) ? raw : [];
    },

    async setLeads(leads) {
      return areaSet('local', KEYS.LEADS, Array.isArray(leads) ? leads : []);
    },

    /**
     * Save (upsert) a lead by id.
     * v0.1.0 ships free-only with no cap (NS.UNLOCKED) — see constants.js.
     * @returns {Promise<{ok:boolean, error?:string, leads:Array}>}
     */
    async saveLead(lead) {
      const leads = await this.getLeads();
      const idx = leads.findIndex((l) => l.id === lead.id);
      if (idx === -1) {
        leads.unshift(lead);
      } else {
        leads[idx] = Object.assign({}, leads[idx], lead, { dismissed: false });
      }
      const res = await this.setLeads(leads);
      if (!res.ok) return { ok: false, error: res.error, leads };
      if (idx === -1) await this.bumpStat('saved', 1);
      return { ok: true, leads };
    },

    /** Soft-delete a lead (keeps it out of the active list). */
    async dismissLead(id) {
      const leads = await this.getLeads();
      const idx = leads.findIndex((l) => l.id === id);
      if (idx !== -1) {
        leads[idx].dismissed = true;
        await this.setLeads(leads);
      }
      return leads;
    },

    async getStats() {
      let s = await areaGet('local', KEYS.STATS);
      if (!s || s.day !== NS.todayKey()) {
        s = NS.defaultStats();
        const leads = await this.getLeads();
        s.saved = leads.filter((l) => !l.dismissed).length;
        await areaSet('local', KEYS.STATS, s);
      }
      return s;
    },

    async bumpStat(field, by) {
      const s = await this.getStats();
      s[field] = (s[field] || 0) + (by || 1);
      await areaSet('local', KEYS.STATS, s);
      return s;
    },

    /** Subscribe to settings changes in EITHER area. cb(newSettings). */
    onSettingsChanged(cb) {
      if (!hasChrome() || !chrome.storage.onChanged) return () => {};
      const handler = async (changes, area) => {
        const touched =
          (area === 'sync' && changes[KEYS.SETTINGS]) ||
          (area === 'local' && changes[KEYS.SETTINGS_LOCAL]);
        if (touched) cb(await Storage.getSettings());
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
  };

  NS.Storage = Storage;
})(globalThis.SubSniper);
