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

In un terminale:

```bash
cd Backend
npm install
npm start
```

In un secondo terminale:

```bash
cd frontend
npm install
npm start
```

L'applicazione è disponibile su `http://localhost:4200`; il proxy Angular
inoltra `/api` al backend sulla porta `3000`.

## Build PWA

```bash
cd frontend
npm run build
npx http-server dist/Hackhub/browser
```

La PWA va verificata tramite HTTPS oppure `localhost`, usando gli strumenti
Application del browser per controllare manifest, service worker e installabilità.

## Test

```bash
cd Backend
npm test

cd ..\frontend
npm test
```

I test backend includono autenticazione, logout, scadenza e persistenza delle
sessioni, API protette e configurazione PWA.
