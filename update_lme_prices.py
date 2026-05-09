#!/usr/bin/env python3
"""
AYYS Commodities — LME Price Updater
Runs daily via GitHub Actions at 16:45 UTC (after LME settlement at 16:30 London)
Source: lme.com official settlement prices

Usage: python3 update_lme_prices.py
Output: prices.json (committed to repo by GitHub Actions)
"""

import json, re, sys, time
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; AYYS-Price-Bot/1.0; +https://www.ayysc.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}

LME_METAL_URLS = {
    'copper':    'https://www.lme.com/en/metals/non-ferrous/lme-copper',
    'nickel':    'https://www.lme.com/en/metals/non-ferrous/lme-nickel',
    'aluminium': 'https://www.lme.com/en/metals/non-ferrous/lme-aluminium',
    'zinc':      'https://www.lme.com/en/metals/non-ferrous/lme-zinc',
    'lead':      'https://www.lme.com/en/metals/non-ferrous/lme-lead',
    'tin':       'https://www.lme.com/en/metals/non-ferrous/lme-tin',
    'cobalt':    'https://www.lme.com/en/metals/minor-metals/lme-cobalt',
}

def fetch_lme_page(url, metal):
    """Fetch and parse LME metal page for settlement price."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        
        # LME renders prices in specific patterns
        # Settlement price pattern: data-settlement or in table
        patterns = [
            r'settlement["\s:]+\$?\s*([\d,]+(?:\.\d+)?)',
            r'Official\s+Settlement[^<]*<[^>]+>\s*\$?\s*([\d,]+(?:\.\d+)?)',
            r'"settlement_price"\s*:\s*([\d.]+)',
            r'data-price="([\d.]+)"',
            r'class="[^"]*settlement[^"]*"[^>]*>\s*\$?\s*([\d,]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                price_str = match.group(1).replace(',', '')
                price = float(price_str)
                if price > 100:  # sanity check
                    print(f"  {metal}: {price:,.0f} USD/t (pattern matched)")
                    return price
        
        print(f"  {metal}: price not found in HTML — keeping last value")
        return None
        
    except (URLError, HTTPError) as e:
        print(f"  {metal}: fetch error — {e}")
        return None

def update_prices():
    """Main update function."""
    print(f"AYYS LME Price Updater — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)
    
    # Load existing prices.json as fallback
    try:
        with open('prices.json', 'r') as f:
            data = json.load(f)
        print("Loaded existing prices.json as fallback")
    except:
        print("ERROR: Could not load prices.json")
        sys.exit(1)
    
    # Update each LME metal
    updated_count = 0
    for metal, url in LME_METAL_URLS.items():
        print(f"\nFetching {metal.upper()}...")
        price = fetch_lme_page(url, metal)
        
        if price and metal in data['metals']:
            old_price = data['metals'][metal].get('settlement', 0)
            change = price - old_price
            change_pct = (change / old_price * 100) if old_price else 0
            
            if metal == 'cobalt':
                data['metals'][metal]['monthly_avg'] = price
                data['metals'][metal]['settlement'] = price
            else:
                data['metals'][metal]['settlement'] = price
                # Estimate cash and 3m from settlement (approximate)
                data['metals'][metal]['cash'] = round(price * 0.9996)
                data['metals'][metal]['three_month'] = round(price * 1.0042)
            
            data['metals'][metal]['change'] = round(change, 2)
            data['metals'][metal]['change_pct'] = round(change_pct, 2)
            updated_count += 1
        
        time.sleep(2)  # Respectful rate limiting
    
    # Update metadata
    now = datetime.now(timezone.utc)
    data['_meta']['updated'] = now.strftime('%Y-%m-%dT%H:%M:%SZ')
    data['_meta']['updated_readable'] = now.strftime('%d %b %Y, %H:%M London')
    
    # Save
    with open('prices.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"Updated {updated_count}/{len(LME_METAL_URLS)} metals")
    print(f"prices.json saved — {now.strftime('%Y-%m-%d %H:%M UTC')}")

if __name__ == '__main__':
    update_prices()
