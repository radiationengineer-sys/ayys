#!/usr/bin/env node
/*
  AYYS Market Price Updater — version 2.0
  Usage: node update-market-prices.js
  Run via GitHub Actions cron (weekdays 18:20 UTC) or manually.

  Sources:
  - Westmetall.com: LME cash settlement J-1 for Cu, Ni, Zn, Al
  - Boursorama: fallback for copper (CAUSD)
  - Trading Economics: reference for Co, Li (indicative, not licensed feed)
*/
'use strict';
const fs = require('fs/promises');
const path = require('path');

const FEED_PATH = path.join(__dirname, 'market-prices.json');

// ── Westmetall scraper ──────────────────────────────────────────────────────
const WESTMETALL_METALS = {
  copper:    { field: 'LME_Cu_cash',  unit: 'USD/t' },
  nickel:    { field: 'LME_Ni_cash',  unit: 'USD/t' },
  zinc:      { field: 'LME_Zn_cash',  unit: 'USD/t' },
  aluminium: { field: 'LME_Al_cash',  unit: 'USD/t' },
};

function parseFrNumber(s) {
  return parseFloat(String(s)
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(',', '.'));
}

function extractPriceWestmetall(html) {
  // Strip tags and get text
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
  // Look for price patterns: a number in the 1,000–100,000 range
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d[\d\s,\.]+)$/);
    if (m) {
      const val = parseFrNumber(m[1]);
      if (val > 500 && val < 200000) {
        // Next line might be the change %
        const mPct = (lines[i+1] || '').match(/([+-]?\d+[,\.]?\d*)\s*%/);
        return {
          price: val,
          pct: mPct ? parseFrNumber(mPct[1]) : null
        };
      }
    }
  }
  // Fallback: regex on raw HTML
  const m2 = text.match(/([\d][\d\s]*[,\.][\d]{2,3})\s*\n\s*([-+]?[\d]+[,\.][\d]+)\s*%/);
  if (m2) {
    return { price: parseFrNumber(m2[1]), pct: parseFrNumber(m2[2]) };
  }
  throw new Error('Price not found in Westmetall response');
}

async function fetchWestmetall(key, cfg) {
  const url = `https://www.westmetall.com/en/markdaten.php?action=table&field=${cfg.field}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AYYS-market-updater/2.0; contact: trading@ayys-group.fr' }
  });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} from Westmetall`);
  const html = await res.text();
  return extractPriceWestmetall(html);
}

// ── Boursorama fallback for copper ──────────────────────────────────────────
async function fetchBoursoramaCopper() {
  const url = 'https://www.boursorama.com/bourse/matieres-premieres/cours/7xCAUSD/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AYYS-market-updater/2.0; contact: trading@ayys-group.fr' }
  });
  if (!res.ok) throw new Error(`Boursorama copper: HTTP ${res.status}`);
  const html = await res.text();
  const text = html.replace(/<[^>]+>/g, '\n').replace(/\u00a0/g, ' ');
  const m = text.match(/([\d][\d\s]*[,\.][\d]{1,3})\s*\n\s*([-+]?[\d]+[,\.][\d]+)%/);
  if (!m) throw new Error('Boursorama: price pattern not found');
  return { price: parseFrNumber(m[1]), pct: parseFrNumber(m[2]) };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const feed = JSON.parse(await fs.readFile(FEED_PATH, 'utf8'));
  const errors = [];

  for (const [key, cfg] of Object.entries(WESTMETALL_METALS)) {
    try {
      let q;
      if (key === 'copper') {
        // Try Westmetall first, fallback to Boursorama
        try {
          q = await fetchWestmetall(key, cfg);
        } catch (e1) {
          console.warn(`  Westmetall copper failed (${e1.message}), trying Boursorama...`);
          q = await fetchBoursoramaCopper();
        }
      } else {
        q = await fetchWestmetall(key, cfg);
      }

      const prev = q.pct != null
        ? q.price / (1 + q.pct / 100)
        : (feed.instruments[key]?.price ?? q.price);

      feed.instruments[key] = {
        ...feed.instruments[key],
        price:   Math.round(q.price * 10) / 10,
        previous: Math.round(prev * 10) / 10,
        pct:     Math.round((q.pct ?? 0) * 100) / 100,
        sourceLabel: `LME ${key.charAt(0).toUpperCase() + key.slice(1)} Cash-Settlement · ${new Date().toLocaleDateString('fr-FR')} · J-1`,
        status: 'fresh',
        updatedAt: new Date().toISOString(),
      };
      console.log(`  ✓ ${key}: ${feed.instruments[key].price} ${feed.instruments[key].unit}`);
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
      console.error(`  ✗ ${key}: ${e.message}`);
      // Keep previous value, mark as stale
      if (feed.instruments[key]) {
        feed.instruments[key].status = 'stale';
        feed.instruments[key].staleSince = new Date().toISOString();
      }
    }
  }

  feed.generatedAt = new Date().toISOString();
  feed.updateErrors = errors.length > 0 ? errors : undefined;

  await fs.writeFile(FEED_PATH, JSON.stringify(feed, null, 2) + '\n');
  
  if (errors.length > 0) {
    console.warn(`\n⚠ ${errors.length} metal(s) failed to update — previous values kept.`);
    process.exit(0); // Don't fail the CI for partial updates
  }
  console.log('\n✓ market-prices.json updated successfully.');
}

main().catch(err => { console.error(err); process.exit(1); });
