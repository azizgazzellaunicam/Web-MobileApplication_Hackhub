# HackHub Web

Frontend web di HackHub, realizzato con Angular 22 e Bootstrap 5.3.

L'applicazione permette di:

- consultare gli hackathon disponibili;
- registrarsi e accedere al proprio profilo;
- creare e gestire un team;
- accettare o rifiutare inviti;
- iscrivere il team agli hackathon;
- inviare e modificare le sottomissioni;
- visualizzare notifiche, classifiche e hackathon vinti;
- gestire le funzioni dedicate a organizzatori, giudici e mentori.

## Tecnologie

- Angular 22
- TypeScript
- Bootstrap 5.3
- RxJS
- Vitest

Per installazione, test e build usare Node.js `^22.22.3`, `^24.15.0` o
`>=26.0.0`, come richiesto dalle dipendenze Angular 22.

## Struttura

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

Avviare prima i due database, RabbitMQ, Identity e il backend seguendo la
procedura [sviluppo con servizi Node locali](../README.md#sviluppo-con-servizi-node-locali).
Poi, in un terminale dalla cartella `frontend`:

```bash
npm install
npm start
```

L'applicazione sarà disponibile su `http://localhost:4200`.

## Comunicazione con il backend

Il frontend invia le richieste agli endpoint `/api/...`. Durante lo sviluppo,
il proxy Angular definito in `proxy.config.json` inoltra `/api/auth/**` a
Identity su `http://localhost:3001` e le altre richieste `/api/**` al backend
su `http://localhost:3000`.

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

## Container Docker

La configurazione Docker Compose si trova nella root del repository. Il
multi-stage build in `frontend/Dockerfile` esegue `npm ci` e
`npm run build -- --configuration production` con Node `22.22.3`, poi copia
solo `dist/Hackhub/browser` in un'immagine Nginx Alpine. La configurazione
`frontend/nginx.conf` serve Angular, applica il fallback SPA su `index.html` e
inoltra `/api/auth/` a `identity:3001` e `/api/` e `/health` a
`backend:3000`. Il browser usa solo l'origine Nginx; backend e Identity non
sono pubblicati sull'host e non serve CORS.

Dalla root del repository, crea `.env` da `.env.example` senza sovrascrivere
un file esistente:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Compila tutte le password richieste, `HACKHUB_JWT_SECRET` e
`HACKHUB_SERVICE_TOKEN` come indicato nel [README principale](../README.md#avvio-locale-con-docker-compose).
Poi esegui `docker compose up --build -d` e apri `http://localhost` oppure la
porta configurata da `FRONTEND_PORT`. Compose espone il frontend, i database
MariaDB e RabbitMQ solo su localhost e conserva i loro dati in volumi Docker.

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
Per verificare gli asset e il service worker della PWA con un server statico:

```bash
npm run build
npx http-server dist/Hackhub/browser
```

Il server statico serve solo il frontend e non inoltra le richieste API; per
provare autenticazione e funzionalità complete usare l'avvio con Docker Compose
descritto nel [README principale](../README.md#avvio-locale-con-docker-compose).

Aprire l'app su `localhost` o HTTPS e controllare in DevTools > Application:
manifest, icone, service worker e voce di installazione. Gli aggiornamenti
vengono gestiti dal ciclo ufficiale Angular: alla nuova build il browser
scarica il nuovo gruppo di asset e lo applica secondo la registrazione del
service worker.

## Autenticazione nel browser

Il backend usa access token JWT e refresh token opachi via cookie `HttpOnly`.
Angular invia le richieste con `withCredentials`, ripristina la sessione
all'avvio tramite `/api/auth/profile` e, in caso di `401`, esegue il rinnovo
automatico con `/api/auth/refresh`.

L'interceptor coordina le richieste simultanee nella scheda con un solo refresh
in-flight e, quando supportata dal browser, usa Web Locks per serializzare i
rinnovi anche tra schede della stessa origine. Le richieste originali vengono
ritentate dopo il rinnovo riuscito. Il backend continua a revocare la famiglia
in caso di riutilizzo effettivo di un refresh token già ruotato.

I token non vengono salvati in `localStorage` o `sessionStorage`. Se il refresh
fallisce (token scaduto/revocato/non valido), il frontend pulisce lo stato
autenticato e reindirizza a login.

Le operazioni che richiedono il backend continuano a mostrare l'errore di rete
se l'app è offline; non vengono considerate riuscite dalla cache PWA.