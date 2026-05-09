# AYYS Commodities — Configuration GitHub pour les prix LME

## Architecture des prix live

```
GitHub Actions (cron 16:45 UTC lundi-vendredi)
    ↓
update_lme_prices.py (scrape lme.com)
    ↓
prices.json (committé dans le repo)
    ↓
lme-prices.js (chargé par chaque page métal)
    ↓
Affichage des prix officiels LME sur le site
```

## Installation (5 minutes)

### 1. Héberger le site sur GitHub Pages

```bash
# Créer un repo GitHub (ex: ayysc-website)
git init
git add .
git commit -m "Initial site"
git remote add origin https://github.com/AYYS/ayysc-website.git
git push -u origin main
```

### 2. Activer GitHub Pages

- Settings → Pages → Source : `main` branch, `/` (root)
- Le site sera disponible sur `https://ayys.github.io/ayysc-website/`

### 3. Activer GitHub Actions

Le fichier `.github/workflows/update-prices.yml` est déjà inclus.
Il s'exécute automatiquement chaque jour ouvré à 16:45 UTC.

Pour tester manuellement :
- GitHub → Actions → "Update LME Prices" → "Run workflow"

### 4. Configurer le domaine custom (ayysc.com)

- Settings → Pages → Custom domain : `ayysc.com`
- Ajouter un CNAME chez votre registrar pointant vers `ayys.github.io`

## Mise à jour manuelle des prix

Si le script automatique échoue, éditer `prices.json` directement :

```json
{
  "_meta": {
    "updated": "2026-05-09T16:30:00Z",
    "updated_readable": "09 May 2026, 16:30 London"
  },
  "metals": {
    "copper": {
      "settlement": 9252,
      "cash": 9241,
      "three_month": 9278,
      "change": -38,
      "change_pct": -0.41
    }
  }
}
```

Sources de référence pour mise à jour manuelle :
- Copper/Nickel/Zinc/Lead/Tin/Aluminium : https://www.lme.com/en/metals
- Cobalt : https://www.lme.com/en/metals/minor-metals/lme-cobalt
- Gold/Silver/Platinum : https://www.lbma.org.uk/prices-and-data/precious-metal-prices
- Lithium : https://www.fastmarkets.com/commodities/battery-materials/lithium/
- Terres rares : https://www.metal.com/Rare-Earth

## Structure de prices.json

Chaque métal contient :
- `settlement` : prix de règlement officiel LME (USD/t)
- `cash` : prix cash (livraison 2 jours)
- `three_month` : prix 3 mois forward
- `change` : variation vs veille (USD)
- `change_pct` : variation % vs veille
- `updated` : timestamp ISO de la dernière mise à jour

## Fonctionnement du JS client

`lme-prices.js` est chargé sur chaque page métal.
Il fetch `/prices.json` et met à jour automatiquement :
- `#lme-price` : prix de règlement
- `#lme-chg` : variation
- `.lme-chg-pct` : variation %
- `[data-lme-field="cash"]` : prix cash
- `[data-lme-field="three_month"]` : prix 3 mois
- `.lme-source-note` : source + date de mise à jour
