# Kratos Training — TestFlight Setup

## Come funziona

L'app **non bundla** il codice HTML/JS localmente.
Carica direttamente da **GitHub Pages** (`server.url` in `capacitor.config.json`).

✅ Aggiornare il codice su GitHub = app aggiornata istantaneamente, senza nuovo submit su TestFlight.
❌ Modifiche native (icone, permessi, plugin Capacitor) richiedono un nuovo build Xcode.

---

## Prerequisiti

- macOS con **Xcode 15+** installato
- **Apple Developer Account** attivo ($99/anno)
- Node.js installato
- Progetto clonato localmente

---

## Setup iniziale (una tantum)

```bash
# 1. Installa dipendenze
npm install

# 2. Sincronizza Capacitor
npx cap sync

# 3. Apri in Xcode
npx cap open ios
```

---

## Configurazione Xcode (prima build)

1. Apri `ios/App/App.xcworkspace` in Xcode
2. Seleziona il progetto **App** nel navigator
3. Tab **Signing & Capabilities**:
   - Team: seleziona il tuo Apple Developer team
   - Bundle Identifier: `com.kratos.training`
   - Signing Certificate: seleziona automatico
4. Tab **General**:
   - Version: `1.0`
   - Build: `1`

---

## Build per TestFlight

```bash
# Prima di ogni build, sincronizza le modifiche native
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
3. Compila il questionario di conformità (Export Compliance)
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

## Aggiornamenti nativi (richiedono nuovo build)

Questi cambiamenti richiedono un nuovo Archive + Upload:
- Nuovi plugin Capacitor
- Modifiche a `Info.plist`
- Nuove icone o splash screen
- Aggiornamento versione app

```bash
npm install @capacitor/new-plugin
npx cap sync
npx cap open ios
# → Product → Archive → Distribute
```

---

## Struttura file rilevanti

```
kratos/
├── capacitor.config.json    ← configurazione Capacitor
├── www/                     ← webDir placeholder (non usato a runtime)
├── ios/                     ← progetto Xcode (non modificare manualmente)
│   └── App/
│       ├── App.xcworkspace  ← apri questo in Xcode
│       └── App/
│           ├── Assets.xcassets/  ← icone e splash
│           └── Info.plist        ← permessi iOS
└── index.html               ← app principale (caricata da GitHub Pages)
```

---

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Build fallisce: "No provisioning profile" | Xcode → Signing → abilita "Automatically manage signing" |
| App mostra pagina bianca | Verifica connessione internet e URL in `capacitor.config.json` |
| Icona nera su device | Esegui `npx cap sync` e ricompila |
| "Missing compliance" su TestFlight | Seleziona "No" alla domanda crittografia (app usa solo HTTPS standard) |
