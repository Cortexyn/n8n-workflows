# 🌤️ Thermik-Vorhersage für Segelflieger

Automatisierte 3-Tages-Thermikprognose für den Segelflugplatz EDXE mit n8n, meteoblue API und Dual-Channel-Versand (Email + Telegram).

## 📋 Übersicht

Dieses Projekt automatisiert die tägliche Berechnung und Verteilung einer detaillierten Thermik-Vorhersage an Segelflieger. Jeden Morgen um 07:00 Uhr werden aktuelle Wetterdaten von der meteoblue API abgerufen, analysiert und als formatierte Email (Premium Dark Design) sowie als kompakte Telegram-Nachricht verschickt.

### ✨ Features

- **Automatischer Schedule**: Tägliche Ausführung um 07:00 Uhr via Cron
- **Präzise Wetterdaten**: meteoblue API mit stündlichen Daten für 3 Tage
- **Thermik-Score**: Intelligenter Algorithmus (0-5) basierend auf CAPE, BLH, Bewölkung, Wind, Spread
- **Steigwerte-Berechnung**: Physik-basierte Climb-Rate-Prognose (7-19 Uhr)
- **Phasen-Analyse**: 4 Tagesabschnitte mit detaillierten Vorhersagen
  - Vormittag (08-12 Uhr)
  - Früher Nachmittag (12-15 Uhr)
  - Später Nachmittag (15-18 Uhr)
  - Abends (18-21 Uhr)
- **Wind-Analyse**: Geschwindigkeit und Richtung pro Phase
- **Dual-Channel-Versand**:
  - Email mit Premium Dark Design, Gradient-Badges und Steigwerte-Chart
  - Telegram mit kompakter HTML-Nachricht
- **Responsive Email-Layout**: Perfekte Darstellung in allen Email-Clients

## 🚀 Tech-Stack

- **n8n** (v1.115.3) – Workflow-Automation
- **meteoblue API** – Wetterdaten (basic-1h, clouds-1h, air-1h packages)
- **JavaScript** – Datenverarbeitung und Score-Algorithmus
- **Telegram Bot API** – Push-Benachrichtigungen
- **SMTP (Gmail)** – Email-Versand
- **Cron** – Zeitgesteuerte Ausführung

## 📂 Projektstruktur

```
n8n workflows/
├── thermik-vorhersage-edxe.json       # Haupt-Workflow (n8n Import-File)
├── thermik-email-code.js              # Standalone Email-Generator Code
├── thermik-premium-dark-code.js       # Premium Dark Theme Variante
└── README.md                          # Dieses File
```

## 🔧 Installation & Setup

### 1. n8n Installation

```bash
npm install -g n8n
n8n start
```

### 2. Workflow importieren

1. n8n öffnen (http://localhost:5678)
2. "Import from File" wählen
3. `thermik-vorhersage-edxe.json` hochladen

### 3. Credentials konfigurieren

**meteoblue API:**
1. API-Key unter https://www.meteoblue.com/en/weather-api beantragen
2. In n8n unter **Credentials** ein neues **HTTP Query Auth** Credential anlegen
3. Als Query-Parameter-Name `apikey` und als Wert den API-Key eintragen
4. Im Node "Fetch Meteoblue API" dieses Credential auswählen

Der API-Key gehört ausschließlich in das verschlüsselte n8n Credential und niemals direkt in den Workflow oder das Repository.

**Telegram Bot:**
1. Bot erstellen: Mit [@BotFather](https://t.me/botfather) sprechen
2. `/newbot` ausführen und Namen vergeben
3. API Token kopieren
4. In n8n Credentials "Telegram API" anlegen
5. Chat-ID ermitteln:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
6. Chat-ID im Workflow-Code anpassen (Zeile mit `telegram_chat_id`)

**Gmail SMTP:**
1. Gmail App-Passwort erstellen (https://myaccount.google.com/apppasswords)
2. In n8n Credentials "SMTP" anlegen:
   - Host: smtp.gmail.com
   - Port: 587
   - User: deine@gmail.com
   - Password: App-Passwort
3. Das SMTP-Credential im Node "Send Email" auswählen
4. Sender- und Empfänger-Email im Workflow anpassen

> **Wichtig:** Ein bereits öffentlich gewordener API-Key muss beim Anbieter widerrufen und durch einen neuen Key ersetzt werden. Das Entfernen aus dem aktuellen Workflow macht einen veröffentlichten Key nicht wieder sicher. Der alte Wert bleibt außerdem in der Git-Historie, solange diese nicht separat und bewusst bereinigt wird.

### Umgang mit Credentials

- Die öffentliche Workflow-Datei enthält keine Secret-Werte und keine instanzspezifischen Credential-Verweise.
- Nach dem Import müssen Meteoblue-, Telegram- und SMTP-Credentials in der eigenen n8n-Instanz ausgewählt werden.
- Vor jedem Commit sollte der aktuelle Repository-Stand mit einem Secret-Scanner geprüft werden.

### 4. Standort anpassen

Im "Fetch Meteoblue API" Node die Koordinaten ändern:

```javascript
lat: 52.2851  // Breitengrad deines Flugplatzes
lon: 7.44055  // Längengrad deines Flugplatzes
asl: 41       // Höhe über Meeresspiegel (meters)
```

### 5. Workflow aktivieren

- Schedule Trigger aktivieren (Toggle oben rechts)
- Fertig! Der Workflow läuft ab jetzt täglich um 07:00 Uhr

## 📊 Datenverarbeitung

### Thermik-Score-Algorithmus

Der Score (0-5) wird basierend auf folgenden Faktoren berechnet:

```javascript
Faktoren (Punkte):
+ Sonnenschein ≥45 min/h: +2 | ≥20 min/h: +1 | ≤5 min/h: -1
+ Bewölkung ≤20%: +1 | ≥85%: -1
+ Niederschlag >0 mm/h: -1 bis -2
+ BLH ≥1800m: +2 | ≥1200m: +1 | <600m: -1
+ CAPE 50-600 J/kg: +1 | >800 J/kg: -1
+ CIN <-50 J/kg: -1
+ Wind 2-6 m/s: +1 | >9 m/s: -1
+ Spread (T-Td) 6-12°C: +1 | <3°C: -1

Endergebnis: Clamp(0, 5)
```

### Steigwerte-Berechnung (Physik-Modell)

```javascript
w = 0.02 * sqrt(CAPE) + 0.6 * BLH_km + 0.3 * sunFrac
  - 0.8 * tccFrac - 0.5 * min(precip, 2.0) - max(0, wind-8) * 0.08

Clamp(0, 5.0) m/s
```

## 🎨 Email-Design

Das Email-Layout verwendet ein **Dark Theme** mit:

- Gradient Header (Teal → Blue)
- 3-Spalten-Layout für die 3 Tage
- Score-Badges mit Gradient-Hintergründen
- Steigwerte-Chart (horizontale Bars, 7-19 Uhr)
- 4 Phase-Blöcke pro Tag
- Responsive Design (funktioniert in Gmail, Outlook, Apple Mail)

**Wichtig für Email-Client-Kompatibilität:**
- Tabellenbasiertes Layout (keine Flexbox/Grid)
- Inline-Styles
- Content-Padding mit `&nbsp;` für gleichhohe Boxen

## 📱 Telegram-Nachricht

Kompakte Text-Nachricht mit HTML-Formatierung:

```
🌤️ Thermik EDXE | 23.10. – 25.10.

🟡 Donnerstag, 24.10.
Score: 3/5 – Brauchbar
📊 Steigwerte: 12h=2.1m/s, 13h=2.3m/s

☀️ Vormittag (08–12 Uhr)
• Bewölkung 67 %, Schauer 0.6 mm/h, BLH ~0 km
• 🌬️ Wind: ~5.3 m/s aus S
• Thermik 1/5. Fetzen, selten zentrierbar.

...
```

## 🔍 Workflow-Aufbau

```
┌─────────────────────┐
│ Schedule Trigger    │  (Täglich 07:00 Uhr)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ Fetch meteoblue API │  (HTTP Request)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ Generate Email +    │  (Code Node)
│ Telegram            │  • Parse API Data
└──────┬──────────┬───┘  • Calculate Scores
       │          │      • Build HTML Email
       │          │      • Format Telegram Text
       │          │
┌──────▼─────┐ ┌─▼─────────┐
│ Send Email │ │ Send to   │
│            │ │ Telegram  │
└────────────┘ └───────────┘
```

## 🐛 Troubleshooting

### Email wird nicht versendet
- Gmail SMTP Credentials prüfen
- 2FA aktiviert? → App-Passwort verwenden
- Port 587 (STARTTLS) oder 465 (SSL) prüfen

### Telegram-Bot antwortet nicht
- Bot-Token korrekt?
- Chat-ID korrekt ermittelt?
- Bot zum Channel/Chat hinzugefügt?

### Workflow-Fehler "Keine Meteoblue-Daten"
- API-Key gültig und aktiv?
- API-Kontingent noch verfügbar?
- Response-Structure prüfen (meteoblue ändert manchmal Field-Namen)

### Boxen nicht gleich hoch in Email
- Prüfe `maxLinesPerPhaseGlobal` Berechnung
- Stelle sicher, dass alle Phase-Blöcke `&nbsp;`-Padding erhalten

## 📈 Performance

- **Execution Time**: ~2-3 Sekunden
- **API Calls**: 1x meteoblue pro Tag
- **Email Size**: ~15-20 KB
- **Telegram Message**: <1 KB

## 🚧 Roadmap / Nächste Features

- [ ] Interaktive Steigwerte-Charts (Chart.js)
- [ ] Machine Learning für Genauigkeitsverbesserung
- [ ] Web-Dashboard mit Kartenvisualisierung
- [ ] Alert-System bei Score ≥4
- [ ] Streckenwetter-Optimierung
- [ ] Multi-Location Support

## 📝 Lizenz

MIT License – Feel free to use and modify for your glider club!

## 🤝 Contributions

Contributions, Issues und Feature-Requests sind willkommen!

Bei Fragen oder Problemen: [GitHub Issues](https://github.com/yourusername/yourrepo/issues)

## 👨‍💻 Autor

**The Coding Cortex**
Website: [thecodingcortex.org](https://thecodingcortex.org)
Projekt-Seite: [Thermik-Vorhersage Details](https://thecodingcortex.org/projekt-thermik-vorhersage.html)

---

*Erstellt mit ❤️ für Segelflieger*
