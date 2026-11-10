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

- Node.js `^22.22.3`, `^24.15.0` o `>=26.0.0` (Node 22.22.3 è il riferimento
  per l'ambiente di deployment);
- npm;
- un browser con supporto ai service worker per installare la PWA.

Il frontend richiede uno dei runtime Node supportati da Angular 22 indicati
sopra; il backend usa `node:sqlite`.

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

## Database e autenticazione

Il backend usa SQLite e conserva il database in `Backend/hackhub.sqlite` per
impostazione predefinita. `HACKHUB_DB_PATH` consente di specificare un percorso
assoluto o relativo alla cartella `Backend`; le directory mancanti vengono
create automaticamente. In un deployment persistente, configurare il percorso
del volume, ad esempio `/app/data/hackhub.sqlite`.

In development/test il seed demo è abilitato per impostazione predefinita e può
essere disabilitato con `HACKHUB_SEED_DEMO=false`. In production non viene
eseguito e il backend rifiuta l'avvio senza `HACKHUB_JWT_SECRET` (almeno 32
caratteri) o se il database contiene account demo.

Variabili JWT: `HACKHUB_JWT_SECRET`, `HACKHUB_ACCESS_TOKEN_TTL` (predefinito
`15m`), `HACKHUB_REFRESH_TOKEN_TTL_SECONDS` (predefinito `604800`),
`HACKHUB_JWT_ISSUER` (predefinito `hackhub-api`) e
`HACKHUB_JWT_AUDIENCE` (predefinito `hackhub-web`). I TTL vengono validati
all'avvio. Il browser riceve token solo tramite cookie `HttpOnly`; in
production i cookie sono `Secure`. Le API e i dati autenticati non vengono
memorizzati offline dal service worker.

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

## Avvio locale con Docker Compose

Prerequisiti: Docker Desktop aggiornato, con Docker Compose v2 abilitato.
Compose costruisce un'immagine per il backend e una per il frontend; i
container sono le istanze in esecuzione. Nginx serve Angular e inoltra `/api/`
e `/health` a Express sulla rete bridge dedicata. Solo Nginx pubblica la porta
HTTP sull'host; la porta `3000` del backend resta interna alla rete Docker.

Prima dell'avvio, crea il file `.env` dalla cartella principale del repository:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Inserisci il valore generato in `HACKHUB_JWT_SECRET` nel file `.env`. Il file
non viene versionato. Se la porta 80 è già occupata, imposta `FRONTEND_PORT`
nel file `.env` (per esempio `8080`).

Costruisci le immagini e avvia l'intero stack in background:

```bash
docker compose up --build -d
```

Apri `http://localhost` (o la porta scelta in `FRONTEND_PORT`). Comandi utili:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

Compose attende che il backend superi il proprio health check SQLite prima di
avviare il frontend. Il database, inclusi eventuali file SQLite WAL/SHM, è
contenuto nel volume nominato `hackhub_data` montato in `/app/data`; i dati
sopravvivono all'arresto, alla ricreazione dei container e al rebuild delle
immagini. `docker compose down` conserva il volume; non usare `docker compose down -v`
se vuoi mantenere i dati.
