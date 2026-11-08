# HackHub

HackHub è una piattaforma per la gestione di hackathon, realizzata con
Angular 22, Bootstrap, Node.js, Express e SQLite.

La versione corrente include una PWA installabile: Angular genera il service
worker ufficiale solo nella build di produzione e mette in cache le risorse
statiche dell'applicazione. Le API e i dati autenticati non vengono aggiunti
alla cache offline.

L'autenticazione usa un access token JWT a vita breve e un refresh token
opaco persistito su SQLite in forma hashata. Il browser riceve solo cookie
`HttpOnly` (`hackhub_access` e `hackhub_refresh`), senza uso di `localStorage`
o `sessionStorage`.

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

I test backend includono autenticazione JWT, refresh token con rotazione e
revoca, autorizzazioni per ruolo, API protette e configurazione PWA.
