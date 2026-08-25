/**
 * SubSniper — storage.js
 * ------------------------------------------------------------------
 * Thin async wrapper over chrome.storage.
 *   settings → chrome.storage.sync   (small, roams across the user's Chrome)
 *   leads    → chrome.storage.local  (can be large, stays on this machine)
 *   stats    → chrome.storage.local  (per-day counters)
 *
 * Everything is defensive: if chrome.storage is unavailable (e.g. a unit
 * context), calls resolve to defaults instead of throwing.
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
          // Swallow lastError (e.g. context invalidated on SPA nav).
          void chrome.runtime.lastError;
          resolve(res ? res[key] : undefined);
        });
      } catch (_e) {
        resolve(undefined);
      }
    });
  }

  function areaSet(area, key, value) {
    return new Promise((resolve) => {
      if (!hasChrome()) return resolve(false);
      try {
        chrome.storage[area].set({ [key]: value }, () => {
          void chrome.runtime.lastError;
          resolve(true);
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  /** Deep-ish merge of stored settings over the defaults so new fields in an
   *  upgrade always have a value. */
  function mergeSettings(stored) {
    const base = NS.defaultSettings();
    if (!stored || typeof stored !== 'object') return base;
    const out = Object.assign({}, base, stored);
    out.license = Object.assign({}, base.license, stored.license || {});
    if (!Array.isArray(out.products)) out.products = base.products;
    return out;
  }

  const Storage = {
    /** @returns {Promise<Object>} full settings, defaults merged in. */
    async getSettings() {
      const raw = await areaGet('sync', KEYS.SETTINGS);
      return mergeSettings(raw);
    },

    /** @param {Object} settings @returns {Promise<boolean>} */
    async setSettings(settings) {
      return areaSet('sync', KEYS.SETTINGS, settings);
    },

    /** Patch a subset of settings and persist. @returns {Promise<Object>} new settings */
    async updateSettings(patch) {
      const cur = await this.getSettings();
      const next = Object.assign({}, cur, patch);
      await this.setSettings(next);
      return next;
    },

    /** @returns {Promise<Array>} saved leads (never null). */
    async getLeads() {
      const raw = await areaGet('local', KEYS.LEADS);
      return Array.isArray(raw) ? raw : [];
    },

    /** @param {Array} leads @returns {Promise<boolean>} */
    async setLeads(leads) {
      return areaSet('local', KEYS.LEADS, Array.isArray(leads) ? leads : []);
    },

    /**
     * Save (upsert) a lead by id. Enforces the free-tier cap unless Pro.
     * @param {Object} lead
     * @returns {Promise<{ok:boolean, reason?:string, leads:Array}>}
     */
    async saveLead(lead) {
      const [leads, settings] = await Promise.all([this.getLeads(), this.getSettings()]);
      const isPro = !!(settings.license && settings.license.pro);
      const idx = leads.findIndex((l) => l.id === lead.id);
      if (idx === -1) {
        const activeCount = leads.filter((l) => !l.dismissed).length;
        if (!isPro && activeCount >= NS.LIMITS.FREE_LEADS) {
          return { ok: false, reason: 'free-limit', leads };
        }
        leads.unshift(lead);
        await this.bumpStat('saved', 1);
      } else {
        leads[idx] = Object.assign({}, leads[idx], lead, { dismissed: false });
      }
      await this.setLeads(leads);
      return { ok: true, leads };
    },

    /** Soft-delete a lead (keeps it out of the active count / list). */
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
        // Preserve the all-time saved count across day rollovers.
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

    /** Subscribe to any settings change. cb(newSettings). Returns unsubscribe. */
    onSettingsChanged(cb) {
      if (!hasChrome() || !chrome.storage.onChanged) return () => {};
      const handler = (changes, area) => {
        if (area === 'sync' && changes[KEYS.SETTINGS]) {
          cb(mergeSettings(changes[KEYS.SETTINGS].newValue));
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    }
  };

  NS.Storage = Storage;
})(globalThis.SubSniper);
