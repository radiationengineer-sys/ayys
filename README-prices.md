# AYYS market prices patch

Pages now read one site-level feed: `market-prices.json`.

Recommended production setup:
1. Host all HTML files and `market-prices.json` in the same folder.
2. Run `node update-market-prices.js` once per business day from a backend or GitHub Actions.
3. Use Boursorama for instruments that exist there, e.g. Copper Grade CAUSD.
4. Do not label cobalt/lithium as daily LME/Boursorama unless you connect a licensed source.

Why this is safer:
- no browser scraping/CORS dependency;
- one source rendered consistently across all language pages;
- clear freshness/source labels;
- no fake 5-second price animation.
