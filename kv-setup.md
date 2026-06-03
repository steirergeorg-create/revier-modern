# KV Setup — Mein Revier

## 1. KV Namespace erstellen

```bash
npx wrangler kv namespace create REVIER_KV
```

Die ausgegebene ID in `wrangler.toml` bei `id = "..."` eintragen.

## 2. Secrets setzen

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put SALT
npx wrangler secret put ADMIN_KEY
```

## 3. Beispiel-Projekt anlegen

```bash
npx wrangler kv key put --binding=REVIER_KV "project:schillerplatz" '{
  "name": "Schillerplatz 6",
  "address": "8010 Graz · Innenstadt",
  "progress": 45,
  "steps": [
    {"name": "Planung & Genehmigung", "desc": "Baugenehmigung erteilt", "status": "done", "date": "Jän 2026"},
    {"name": "Erdarbeiten & Fundament", "desc": "Fundamentplatte betoniert", "status": "done", "date": "Feb 2026"},
    {"name": "Rohbau", "desc": "Mauerwerk im Gange", "status": "active", "date": "läuft"},
    {"name": "Innenausbau", "desc": "Beginn geplant", "status": "open", "date": "Q4 2026"},
    {"name": "Fertigstellung", "desc": "Schlüsselübergabe", "status": "open", "date": "Q1 2027"}
  ],
  "updates": [
    {"date": "02.06.2026", "text": "Rohbau Stockwerk 2 abgeschlossen. Nächste Woche beginnt Stockwerk 3."},
    {"date": "15.05.2026", "text": "Fensterlieferung bestätigt. Einbau ab August 2026."},
    {"date": "01.04.2026", "text": "Fundamentplatte erfolgreich betoniert. Rohbau startet plangemäß."}
  ],
  "photos": [],
  "docs": [
    {"name": "Bauträgervertrag", "date": "15.01.2026", "size": "1.2 MB", "url": ""},
    {"name": "Energieausweis", "date": "20.01.2026", "size": "0.4 MB", "url": ""},
    {"name": "Grundriss Ihre Wohnung", "date": "15.01.2026", "size": "2.1 MB", "url": ""}
  ]
}'
```

## 4. Benutzer anlegen (via API)

```bash
curl -X POST https://revier-modern.steirergeorg.workers.dev/api/admin/user \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: DEIN_ADMIN_KEY" \
  -d '{
    "email": "kunde@beispiel.at",
    "password": "sicheresPasswort123",
    "name": "Max Mustermann",
    "project": "schillerplatz",
    "top": "04",
    "unit": "3-Zimmer · 72 m²"
  }'
```
