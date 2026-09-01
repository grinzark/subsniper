/**
 * SubSniper — popup.js
 * Quick stats + master on/off toggle + links. No scoring happens here.
 */
(function (NS) {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function crosshairSvg(size) {
    size = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
      'xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" ' +
      'stroke-width="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg>';
  }

  async function render() {
    $('pp-mark').innerHTML = crosshairSvg(20);

    const [settings, stats, lic] = await Promise.all([
      NS.Storage.getSettings(),
      NS.Storage.getStats(),
      NS.License.getStatus()
    ]);

    $('pp-enabled').checked = !!settings.enabled;
    $('pp-found').textContent = String(stats.found || 0);
    $('pp-saved').textContent = String(stats.saved || 0);

    // Plan UI only exists when billing is switched on (billing-config.js).
    const products = (settings.products || []).length;
    const plural = products === 1 ? ' product' : ' products';
    const planEl = $('pp-plan');
    const upBtn = $('pp-upgrade');
    planEl.classList.toggle('is-pro', !!lic.pro);
    if (!lic.billing) {
      planEl.textContent = 'v' + NS.VERSION + ' · free';
      upBtn.hidden = true;
      $('pp-limits').textContent = products + plural + ' tracked · all features unlocked';
    } else if (lic.pro) {
      planEl.textContent = 'Pro';
      upBtn.hidden = true;
      $('pp-limits').textContent = products + plural + ' tracked · unlimited products + AI drafts';
    } else {
      planEl.textContent = 'Free plan';
      upBtn.hidden = false;
      $('pp-limits').textContent = 'Free tracks ' + NS.LIMITS.FREE_PRODUCTS + ' product · Pro: unlimited + AI drafts';
    }
  }

  function wire() {
    $('pp-enabled').addEventListener('change', async (e) => {
      await NS.Storage.updateSettings({ enabled: e.target.checked });
    });
    $('pp-options').addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
      else window.open(chrome.runtime.getURL('src/options/options.html'));
    });
    $('pp-upgrade').addEventListener('click', () => NS.License.startCheckout());
  }

  document.addEventListener('DOMContentLoaded', () => { wire(); render(); });
})(globalThis.SubSniper);
