# AYYS market prices patch

Pages read one site-level feed: `market-prices.json`.

Production rule:
- Treat current values as **indicative references**, not validated real-time prices.
- Use `generatedAt`, `sourceLabel`, `freshness`, and `status` in the UI.
- Do not display cobalt/lithium as live unless a licensed vendor feed is connected.

Recommended setup:
1. Host all HTML files and `market-prices.json` in the same folder.
2. Run `node update-market-prices.js` once per business day from a backend or GitHub Actions.
3. Copper can be refreshed from Boursorama CAUSD when markup is available.
4. Cobalt/lithium should be refreshed from a licensed/authorized vendor feed or reviewed manually.

Why this is safer:
- no browser scraping/CORS dependency;
- one source rendered consistently across language pages;
- clear freshness/source labels;
- no fake 5-second price animation.
