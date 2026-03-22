# Kratos Training — TestFlight Setup

## Come funziona

L'app **non bundla** il codice HTML/JS localmente.
Carica direttamente da **GitHub Pages** (`server.url` in `capacitor.config.json`).

✅ Aggiornare il codice su GitHub = app aggiornata istantaneamente, senza nuovo submit su TestFlight.
❌ Modifiche native (icone, permessi, plugin Capacitor) richiedono un nuovo build Xcode.

> **Capacitor v8 usa Swift Package Manager (SPM)** — nessun `pod install` necessario.

---

## Prerequisiti

- macOS con **Xcode 15+** installato
- **Apple Developer Account** attivo ($99/anno)
- Node.js installato
- Progetto clonato localmente

---

## Setup iniziale (una tantum)

```bash
# 1. Installa dipendenze Node (necessario anche per SPM — Package.swift referenzia node_modules)
npm install

# 2. Sincronizza Capacitor
npx cap sync

# 3. Apri in Xcode
npx cap open ios
```

> ⚠️ `npm install` deve essere eseguito **prima** di aprire Xcode.
> `Package.swift` referenzia `@capacitor/splash-screen` da `node_modules/` via path locale.

---

## Configurazione Xcode (prima build)

1. `npx cap open ios` apre `ios/App/App.xcodeproj` in Xcode
2. Seleziona il progetto **App** nel navigator (non CapApp-SPM)
3. Tab **Signing & Capabilities**:
   - ✅ Automatically manage signing
   - Team: seleziona il tuo Apple Developer team
   - Bundle Identifier: `com.kratos.training`
4. Tab **General**:
   - Version: `1.0`
   - Build: `1`
5. Xcode scarica i package SPM automaticamente al primo avvio (richiede internet)

---

## Build per TestFlight

```bash
# Prima di ogni build, sincronizza le modifiche native
npm install       # solo se hai aggiunto/aggiornato pacchetti
npx cap sync
npx cap open ios
```

In Xcode:

1. **Device**: seleziona `Any iOS Device (arm64)` (non il simulatore)
2. Menu **Product → Archive**
3. Attendi il completamento (Organizer si apre automaticamente)
4. Click **Distribute App**
5. Seleziona **App Store Connect**
6. Segui il wizard → **Upload**

---

## Pubblicare su TestFlight

1. Vai su [App Store Connect](https://appstoreconnect.apple.com)
2. Sezione **TestFlight** → la build comparirà dopo 5-15 minuti
3. Compila il questionario di conformità (Export Compliance):
   - "Does your app use encryption?" → **No** (usa solo HTTPS standard)
4. **Aggiungi tester**:
   - Tester interni (fino a 100): sezione *Internal Testing*
   - Tester esterni (fino a 10.000): sezione *External Testing* → inserisci email

---

## Aggiornare l'app senza risubmittare

Modifica il codice in `index.html`, fai commit e push su GitHub.
L'app caricherà automaticamente la nuova versione al prossimo avvio (via `server.url`).

```bash
git add index.html
git commit -m "Update: ..."
git push
```

---

## Aggiornamenti nativi (richiedono nuovo build Xcode)

Questi cambiamenti richiedono un nuovo Archive + Upload:
- Nuovi plugin Capacitor
- Modifiche a `Info.plist`
- Nuove icone o splash screen
- Aggiornamento versione app (`General → Version/Build`)

```bash
npm install @capacitor/new-plugin
npx cap sync
npx cap open ios
# → Product → Archive → Distribute App → App Store Connect → Upload
```

---

## Struttura file rilevanti

```
kratos/
├── capacitor.config.json        ← configurazione Capacitor + server.url
├── www/index.html               ← webDir placeholder (non usato a runtime)
├── package.json                 ← dipendenze Capacitor
├── ios/                         ← progetto Xcode (non modificare manualmente)
│   └── App/
│       ├── App.xcodeproj        ← apri questo in Xcode (o usa npx cap open ios)
│       ├── CapApp-SPM/
│       │   └── Package.swift    ← dipendenze SPM (gestito da Capacitor)
│       └── App/
│           ├── Assets.xcassets/ ← icone AppIcon + Splash
│           └── Info.plist       ← permessi iOS
└── index.html                   ← app principale (caricata da GitHub Pages)
```

---

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Xcode: "missing package" / SPM error | Esegui `npm install` poi `npx cap sync`, poi riapri Xcode |
| Build fallisce: "No provisioning profile" | Xcode → Signing → abilita "Automatically manage signing" |
| App mostra pagina bianca | Verifica connessione internet e `server.url` in `capacitor.config.json` |
| App mostra contenuto vecchio | Hard refresh non disponibile su app native — verifica GitHub Pages deployment |
| Icona nera su device | Esegui `npx cap sync` e ricompila |
| "Missing compliance" su TestFlight | Seleziona "No" alla domanda crittografia (HTTPS standard) |
| Xcode: "Signing requires a development team" | Preferences → Accounts → aggiungi Apple ID |
