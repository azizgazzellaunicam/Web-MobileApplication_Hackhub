# HackHub

HackHub è una piattaforma per la gestione di hackathon, realizzata con
Angular 22, Bootstrap, Node.js, Express e SQLite.

La versione corrente include una PWA installabile: Angular genera il service
worker ufficiale solo nella build di produzione e mette in cache le risorse
statiche dell'applicazione. Le API e i dati autenticati non vengono aggiunti
alla cache offline.

L'autenticazione usa sessioni persistenti nel database SQLite. Il browser
riceve un cookie `HttpOnly`, mentre il backend conserva solo l'hash del token
di sessione, con scadenza di otto ore e invalidazione esplicita al logout.

## Requisiti

- Node.js con supporto a `node:sqlite`;
- npm;
- un browser con supporto ai service worker per installare la PWA.

## Avvio

Il codice dell'applicazione si trova in `src/app` ed è organizzato per aree:

- `core`: autenticazione, guardie di routing, interceptor e servizi condivisi;
- `features/auth`: registrazione, login e profilo;
- `features/hackathons`: elenco e dettaglio degli hackathon;
- `features/workspace`: team, inviti, sottomissioni e spazio personale;
- `features/notifications`: notifiche dell'utente;
- `features/organizer`: funzioni per gli organizzatori;
- `features/staff`: funzioni per giudici e mentori.

Gli ambienti si trovano in `src/environments`. L'indirizzo delle API è
configurato come `/api`, così il frontend utilizza sempre percorsi relativi.

## Avvio in sviluppo

Avviare prima il backend:

```bash
cd ..\Backend
npm install
npm start
```

In un secondo terminale, dalla cartella `frontend`:

```bash
npm install
npm start
```

L'applicazione sarà disponibile su `http://localhost:4200`.

## Comunicazione con il backend

Il frontend invia le richieste agli endpoint `/api/...`. Durante lo sviluppo,
il proxy Angular definito in `proxy.config.json` inoltra le richieste a
`http://localhost:3000`.

Il browser comunica quindi con il frontend sulla stessa origine e il backend
non viene contattato direttamente dall'interfaccia.

## Comandi utili

```bash
# Avvia il server di sviluppo
npm start

# Crea la build di produzione
npm run build

# Esegue i test
npm test
```

La build viene generata nella cartella `dist/Hackhub`.

## PWA

HackHub usa il supporto ufficiale Angular PWA tramite
`@angular/service-worker`. Non è presente un service worker personalizzato.

- `public/manifest.webmanifest` definisce nome, icone, colori e modalità
  `standalone`;
- `public/icons` contiene le icone generate per le dimensioni comuni;
- `ngsw-config.json` configura la cache delle risorse statiche Angular,
  fogli di stile, bundle JavaScript, manifest e immagini;
- le richieste API `/api` non sono incluse negli asset group e non vengono
  memorizzate offline;
- il service worker è abilitato solo nella configurazione `production` e
  viene registrato quando l'applicazione è stabile.

In sviluppo `npm start` continua a usare il dev server senza service worker.
Per verificare la PWA:

```bash
npm run build
npx http-server dist/Hackhub/browser
```

Aprire l'app su `localhost` o HTTPS e controllare in DevTools > Application:
manifest, icone, service worker e voce di installazione. Gli aggiornamenti
vengono gestiti dal ciclo ufficiale Angular: alla nuova build il browser
scarica il nuovo gruppo di asset e lo applica secondo la registrazione del
service worker.

## Autenticazione nel browser

Il backend usa una sessione persistente in SQLite e un cookie `HttpOnly`.
Angular invia le richieste con `withCredentials` e ripristina la sessione
all'avvio tramite `/api/auth/profile`. Il token di sessione non viene salvato
in `localStorage` o `sessionStorage`. Le operazioni che richiedono il backend
continuano a mostrare l'errore di rete se l'app è offline; non vengono
considerate riuscite dalla cache PWA.