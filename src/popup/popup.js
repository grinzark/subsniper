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

    const [settings, stats, status] = await Promise.all([
      NS.Storage.getSettings(),
      NS.Storage.getStats(),
      NS.License.getStatus()
    ]);

    $('pp-enabled').checked = !!settings.enabled;
    $('pp-found').textContent = String(stats.found || 0);
    $('pp-saved').textContent = String(stats.saved || 0);

    const planEl = $('pp-plan');
    const upBtn = $('pp-upgrade');
    if (status.pro) {
      planEl.textContent = 'Pro plan';
      planEl.classList.add('is-pro');
      upBtn.textContent = '✓ Pro active';
      upBtn.classList.add('is-pro');
      upBtn.disabled = false;
    } else {
      planEl.textContent = 'Free plan';
      upBtn.textContent = '✦ Upgrade to Pro';
    }

    const products = (settings.products || []).length;
    $('pp-limits').textContent = status.pro
      ? 'Unlimited products & saved leads'
      : products + '/' + NS.LIMITS.FREE_PRODUCTS + ' product · up to ' + NS.LIMITS.FREE_LEADS + ' saved leads';
  }

  function wire() {
    $('pp-enabled').addEventListener('change', async (e) => {
      await NS.Storage.updateSettings({ enabled: e.target.checked });
    });
    $('pp-options').addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
      else window.open(chrome.runtime.getURL('src/options/options.html'));
    });
    $('pp-upgrade').addEventListener('click', async () => {
      const status = await NS.License.getStatus();
      if (status.pro) {
        if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
        return;
      }
      NS.License.startCheckout();
    });
  }

  document.addEventListener('DOMContentLoaded', () => { wire(); render(); });
})(globalThis.SubSniper);
