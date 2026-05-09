/**
 * AYYS Commodities — LME Price Loader
 * Fetches prices.json (updated daily by GitHub Actions from lme.com)
 * and updates the price display on each metal page.
 * 
 * Source: London Metal Exchange (lme.com) — Official Settlement Prices
 */

(function() {
  'use strict';

  // Map page to metal key in prices.json
  const PAGE_METAL = {
    'copper':          'copper',
    'cobalt':          'cobalt',
    'lithium':         'lithium',
    'nickel':          'nickel',
    'precious-metals': 'gold',
    'rare-earths':     'rare_earths',
  };

  // Detect current metal from URL
  function detectMetal() {
    const path = window.location.pathname;
    for (const [key] of Object.entries(PAGE_METAL)) {
      if (path.includes(key)) return key;
    }
    return null;
  }

  function formatPrice(value, decimals = 0) {
    if (value === undefined || value === null) return '—';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatChange(change, pct) {
    if (change === undefined) return '';
    const sign = change >= 0 ? '+' : '';
    const arrow = change >= 0 ? '▲' : '▼';
    const cls = change >= 0 ? 'up' : 'dn';
    return { text: `${arrow} ${sign}${formatPrice(change, 0)}`, pct: `${sign}${pct?.toFixed(2)}%`, cls };
  }

  function updateDisplay(metalKey, data) {
    const metal = data.metals[metalKey];
    if (!metal) return;

    // Main price display
    const priceEl = document.getElementById('lme-price');
    const chgEl   = document.getElementById('lme-chg');
    const chgPct  = document.querySelector('.lme-chg-pct');
    const updEl   = document.getElementById('lme-updated');
    const liveEl  = document.querySelector('.lme-live');

    if (priceEl) {
      const price = metal.settlement || metal.monthly_avg || metal.price;
      priceEl.textContent = formatPrice(price);
      priceEl.style.opacity = '1';
    }

    if (chgEl) {
      const { text, pct, cls } = formatChange(metal.change, metal.change_pct);
      chgEl.textContent = text;
      chgEl.className = `lme-chg-val ${cls}`;
    }

    if (chgPct && metal.change_pct !== undefined) {
      const sign = metal.change_pct >= 0 ? '+' : '';
      chgPct.textContent = `${sign}${metal.change_pct?.toFixed(2)}% today`;
    }

    if (updEl) {
      updEl.textContent = `Settlement: ${data._meta.updated_readable}`;
    }

    // Update live dot + label
    if (liveEl) {
      const dot = liveEl.querySelector('.lme-dot');
      liveEl.innerHTML = '';
      if (dot) liveEl.appendChild(dot);
      liveEl.appendChild(document.createTextNode(' LME Official'));
    }

    // Update grid cells if present (cash / 3m)
    document.querySelectorAll('[data-lme-field]').forEach(el => {
      const field = el.getAttribute('data-lme-field');
      if (metal[field] !== undefined) {
        el.textContent = formatPrice(metal[field]);
      }
    });

    // Source note
    document.querySelectorAll('.lme-source-note').forEach(el => {
      if (metal.lme_url) {
        el.innerHTML = `Data: <a href="${metal.lme_url}" target="_blank" rel="noopener">lme.com</a> &middot; Official Settlement &middot; Updated ${data._meta.updated_readable}`;
      }
    });
  }

  function showError() {
    const priceEl = document.getElementById('lme-price');
    if (priceEl) {
      priceEl.textContent = '—';
      priceEl.style.opacity = '0.4';
    }
    const liveEl = document.querySelector('.lme-live');
    if (liveEl) liveEl.innerHTML = 'Offline';
  }

  // Main: fetch prices.json and update
  function loadPrices() {
    const metal = detectMetal();
    if (!metal) return;

    const metalKey = PAGE_METAL[metal];

    // Try to fetch prices.json (same origin)
    const cacheBust = Math.floor(Date.now() / 3600000); // Refresh hourly
    fetch(`/prices.json?v=${cacheBust}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        updateDisplay(metalKey, data);
        console.log(`[AYYS] LME prices loaded — ${data._meta.updated_readable}`);
      })
      .catch(err => {
        console.warn(`[AYYS] Could not load prices.json: ${err.message}`);
        showError();
      });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPrices);
  } else {
    loadPrices();
  }

})();
