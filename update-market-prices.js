#!/usr/bin/env node
/*
  AYYS daily market feed updater.
  Usage: node update-market-prices.js
  Notes:
  - Use this server-side or in GitHub Actions, not in the browser.
  - Boursorama does not expose a stable public JSON API for all critical metals.
  - Copper is mapped to Boursorama CAUSD. Cobalt/lithium require a licensed/authorized vendor or manual input.
*/
const fs = require('fs/promises');
const path = require('path');

const FEED_PATH = path.join(__dirname, 'market-prices.json');
const SOURCES = {
  copper: { url: 'https://www.boursorama.com/bourse/matieres-premieres/cours/7xCAUSD/', source: 'Boursorama', sourceLabel: 'Boursorama · Copper Grade CAUSD · LME' }
};

function parseFrenchNumber(s){
  return Number(String(s).replace(/\u00a0/g,' ').replace(/\s/g,'').replace(',', '.').replace(/[^0-9.\-]/g,''));
}
function findQuote(html){
  const text = html.replace(/<[^>]+>/g, '\n').replace(/\u00a0/g, ' ');
  const m = text.match(/(\d[\d\s]*[,\.]\d{1,3})\s*\n\s*([-+]?\d+[,\.]\d+)%/);
  if(!m) throw new Error('Quote pattern not found; Boursorama markup may have changed.');
  return { price: parseFrenchNumber(m[1]), pct: parseFrenchNumber(m[2]) };
}
async function main(){
  const feed = JSON.parse(await fs.readFile(FEED_PATH, 'utf8'));
  for(const [key, cfg] of Object.entries(SOURCES)){
    const res = await fetch(cfg.url, { headers: { 'user-agent': 'AYYS daily price updater; contact@ayys-group.fr' } });
    if(!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
    const html = await res.text();
    const q = findQuote(html);
    const prev = q.pct ? q.price / (1 + q.pct/100) : feed.instruments[key].previous;
    feed.instruments[key] = { ...feed.instruments[key], price: q.price, previous: prev, pct: q.pct, source: cfg.source, sourceUrl: cfg.url, sourceLabel: cfg.sourceLabel, status: 'fresh' };
  }
  feed.generatedAt = new Date().toISOString();
  await fs.writeFile(FEED_PATH, JSON.stringify(feed,null,2)+'\n');
}
main().catch(err=>{ console.error(err); process.exit(1); });
