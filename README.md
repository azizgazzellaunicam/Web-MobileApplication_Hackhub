# HackHub

HackHub è una piattaforma per la gestione di hackathon, realizzata con Angular 22, Node.js, Express e MariaDB.

## Avvio locale (senza Docker)

Il servizio Identity (`Backend/src/identity-server.js`) va avviato prima del backend: il backend lo interroga per gli utenti (`IDENTITY_SERVICE_URL`). Richiede un MariaDB dedicato (`hackhub_identity`), `HACKHUB_SERVICE_TOKEN` e `RABBITMQ_URL` (broker su cui Identity pubblica gli eventi e il backend li consuma). In locale RabbitMQ si avvia con Docker (vedi [Test](#test)).

Identity:

```bash
cd Backend
npm install
npm run start:identity
```

Backend:

```bash
cd Backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm start
```

## Variabili d’ambiente principali

Nel file `.env` (partendo da `.env.example`):

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_SIZE`
- `DB_ROOT_PASSWORD` (richiesta da Docker Compose per il servizio MariaDB)
- `IDENTITY_DB_NAME`, `IDENTITY_DB_USER`, `IDENTITY_DB_PASSWORD`, `IDENTITY_DB_ROOT_PASSWORD`, `IDENTITY_DB_PORT` (database dedicato di Identity, obbligatori in Docker Compose)
- `HACKHUB_JWT_SECRET`
- `HACKHUB_SERVICE_TOKEN` (almeno 32 caratteri; autentica le chiamate interne monolite → Identity)
- `IDENTITY_SERVICE_URL` (URL di Identity per il backend; in Compose è impostata automaticamente)
- `RABBITMQ_URL` (broker per Identity e backend, formato `amqp://utente:password@host:5672`; in Compose è costruita da `RABBITMQ_USER` e `RABBITMQ_PASSWORD`)
- `RABBITMQ_USER`, `RABBITMQ_PASSWORD` (credenziali del broker, obbligatorie in Docker Compose), `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT` (porte sul localhost)
- `HACKHUB_ACCESS_TOKEN_TTL`
- `HACKHUB_REFRESH_TOKEN_TTL_SECONDS`
- `HACKHUB_JWT_ISSUER`
- `HACKHUB_JWT_AUDIENCE`
- `FRONTEND_PORT`

## Docker Compose

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f
docker compose down
```

Lo stack avvia:

- `mariadb` con volume persistente `mariadb_data`, per il dominio (team, hackathon, competizione, supporto, notifiche);
- `identity-mariadb` con volume `identity_mariadb_data`, dedicato al solo servizio Identity (`hackhub_identity`);
- `identity` (immagine da `Backend/Dockerfile.identity`, `src/identity-server.js`), che gestisce utenti, sessioni e token. È raggiungibile solo sulla rete Docker;
- `rabbitmq` (`rabbitmq:4-management`) con volume `rabbitmq_data`, broker degli eventi tra Identity e backend. La console di gestione è su `127.0.0.1:15672`;
- `backend` (monolite di dominio) collegato a `mariadb`, a `rabbitmq` (consumer degli eventi) e a `identity` tramite `IDENTITY_SERVICE_URL`;
- `frontend` (Nginx) che espone l’app Angular. Nginx instrada `/api/auth/*` a `identity` e il resto di `/api/*` a `backend`.

La persistenza dati è garantita dai volumi MariaDB anche dopo riavvii dei container.

## Migrazione da SQLite

Se hai un vecchio file SQLite (`Backend/hackhub.sqlite`), puoi trasferire i dati:

```bash
cd Backend
npm run db:migrate:sqlite
```

Lo script scrive `users`, `sessions` e `refresh_tokens` nel database di Identity (`IDENTITY_DB_*`, default `hackhub_identity`) e le altre tabelle nel database di dominio (`DB_*`).

Opzionale: `SQLITE_SOURCE_PATH=/path/al/file.sqlite`.

## Architettura backend

Il backend è diviso in moduli con confini di dominio. Il servizio **Identity** è stato estratto come servizio separato con database proprio. Gli altri moduli restano nel monolite, che ora accede agli utenti solo tramite le API interne di Identity.

| Modulo | Cartella | Tabelle | Ruolo |
|---|---|---|---|
| Identity (servizio separato) | `Backend/src/modules/identity/` | `users`, `sessions`, `refresh_tokens` | Utenti, login, sessioni, token |
| Team | `Backend/src/modules/team/` | `teams`, `team_members`, `team_invitations` | Team, membri, inviti |
| Hackathon | `Backend/src/modules/hackathon/` | `hackathons`, `hackathon_staff` | Hackathon, regolamento, date, staff |
| Competition | `Backend/src/modules/competition/` | `registrations`, `submissions`, `evaluations`, `winners` | Iscrizioni, valutazioni, classifiche, vincitori |
| Support | `Backend/src/modules/support/` | `support_requests`, `support_calls` | Richieste di supporto e appuntamenti |
| Notification | `Backend/src/modules/notification/` | `notifications` | Creazione, lettura e conteggio notifiche |

- `Backend/src/identity-app.js` è il composition root di Identity; `Backend/src/identity-server.js` ne è l'entrypoint (porta `PORT`, default 3001).
- Le route pubbliche di Identity restano sotto `/api/auth/*`. Le route interne sono `/internal/*` e richiedono l'header `x-hackhub-service-token`.
- Il monolite verifica i JWT in locale con `HACKHUB_JWT_SECRET`, senza chiamare Identity a ogni richiesta.
- `Backend/src/gateway/hackathon-gateway.js` compone i dati di più moduli (ad esempio `winner_team_id`, stato e flag per utente) per le risposte degli hackathon.
- `Backend/src/domain/hackathon-status.js` contiene le regole di stato dell'hackathon.
- `Backend/src/app.js` è il composition root del monolite: crea le repository, il client HTTP verso Identity (`http-identity-directory.js`), i servizi e registra le route dei moduli.

Deviazioni dal piano:
- il vincitore non è più una colonna `hackathons.winner_team_id`, ma la tabella `winners` di proprietà di Competition. La migrazione di schema la crea e rimuove la colonna in modo automatico;
- le foreign key verso `users` sono state rimosse dalle tabelle di dominio, perché gli utenti ora vivono in un altro database. Gli ID utente sono validati tramite Identity.

## Comunicazione tra servizi

- **Chiamate sincrone**: il monolite chiama Identity via HTTP interno (`/internal/*`), autenticato con `x-hackhub-service-token` (`HACKHUB_SERVICE_TOKEN`). Il token è condiviso tra i servizi; token per servizio sono previsti in una fase successiva.
- **Eventi (Outbox → RabbitMQ → Inbox)**: Identity scrive gli eventi nella tabella `outbox_events` nella stessa transazione della modifica che li produce. Un relay li pubblica su RabbitMQ (exchange `hackhub.events`, con conferma del publisher) ogni 2 secondi, in ordine. Il backend consuma la coda `hackhub.backend.events` e registra ogni evento in `inbox_events` (chiave `event_id`) nella stessa transazione dei suoi effetti. Il flusso dettagliato, con retry, dead-letter queue e diagrammi, è in [docs/messaggistica.md](docs/messaggistica.md).
- **Retry e dead-letter**: il consumer ritenta un evento il cui handler fallisce con attese di 1s, 2s, 4s, 8s e 16s (ogni attesa è una coda con TTL, senza bloccare gli altri eventi). Dopo cinque retry l'evento va nella coda `hackhub.backend.events.dead`, con `x-attempts` e `x-last-error`. Un messaggio malformato va subito in dead-letter. Il relay dell'Outbox ritenta la pubblicazione con le stesse attese e marca `dead_lettered_at` dopo cinque retry.
- Garanzie: consegna *at-least-once* con inbox idempotente, non *exactly-once*. Un duplicato viene ignorato dall'Inbox. I retry possono far arrivare un evento dopo quelli successivi: il backend non deve dipendere dall'ordine tra eventi diversi.
- Evento attuale: `user.registered` (emesso da Identity alla registrazione, con `userId`, `name`, `email`). Il monolite lo registra senza effetti visibili.
- Variabile richiesta da Identity e dal backend: `RABBITMQ_URL`.
- **Compensazione nel monolite**: l'invito a un team crea l'invito e poi la notifica, che usano connessioni diverse. Se la notifica fallisce, l'invito appena creato viene cancellato e la richiesta fallisce.
- **Identity non disponibile**: le chiamate sincrone del monolite a Identity rispondono `502` senza scrivere nulla in locale.

Limiti noti: la consegna è *at-least-once* (un crash tra consegna e marcatura provoca una nuova consegna, assorbita dall'Inbox); i retry possono far arrivare un evento dopo uno successivo; le righe pubblicate o in dead-letter in `outbox_events` non vengono ancora eliminate né riesaminate automaticamente; la coda di dead-letter non viene ancora riesaminata né svuotata automaticamente; l'Outbox del monolite non esiste ancora, perché in questa fase non emette eventi; la `RABBITMQ_PASSWORD` è inserita nell'URL, quindi non deve contenere caratteri speciali URL (`@`, `:`, `/`, `%`, `#`).

## Test

```bash
cd Backend
npm test                 # test backend (richiede MariaDB, vedi DB_*)
npm run test:coverage    # test backend + soglia di copertura righe ≥ 90%
npm run test:identity    # test del solo servizio Identity (sottoinsieme della suite)

cd ../frontend
npx ng test --watch=false  # test frontend (Vitest, nessun browser richiesto)
```

I test usano MariaDB (`DB_*`), un secondo database per Identity (`hackhub_identity_test`, che deve esistere con privilegi per `DB_USER`; in CI viene creato dal workflow) e RabbitMQ (`RABBITMQ_URL`, default `amqp://hackhub:hackhub@127.0.0.1:5672`). I test di integrazione tra Identity e backend usano il broker reale. Per avviare MariaDB e RabbitMQ temporanei in locale:

```bash
docker run -d --name hackhub-test-db -p 127.0.0.1:3307:3306 \
  -e MARIADB_DATABASE=hackhub_test -e MARIADB_USER=hackhub \
  -e MARIADB_PASSWORD=hackhub -e MARIADB_ROOT_PASSWORD=root mariadb:11.8
docker exec hackhub-test-db mariadb -uroot -proot -e "CREATE DATABASE hackhub_identity_test; GRANT ALL PRIVILEGES ON hackhub_identity_test.* TO 'hackhub'@'%';"
docker run -d --name hackhub-test-rabbitmq -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -e RABBITMQ_DEFAULT_USER=hackhub -e RABBITMQ_DEFAULT_PASS=hackhub rabbitmq:4-management
DB_PORT=3307 DB_PASSWORD=hackhub DB_NAME=hackhub_test npm run test:coverage
docker rm -f hackhub-test-db hackhub-test-rabbitmq
```

## CI/CD (GitHub Actions)

Il workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) viene eseguito automaticamente su push e pull request verso `main` (ed è avviabile manualmente con `workflow_dispatch`). Ogni servizio ha job di test e un'immagine Docker indipendenti:

1. **Build** – installazione delle dipendenze di `Backend` e `frontend` (`npm ci`) e build Angular di produzione; la build è caricata come artifact `frontend-dist`.
2. **Test** – tre job in parallelo, dopo Build:
   - `test-backend`: MariaDB 11.8 e RabbitMQ 4 come service container, suite completa del monolite con soglia di copertura (`npm run test:coverage`);
   - `test-identity`: MariaDB 11.8 dedicato e RabbitMQ 4, `npm run test:identity`;
   - `test-frontend`: test Angular (`npx ng test --watch=false`).
3. **Package** – costruisce le immagini Docker di `Backend/Dockerfile` (monolite), `Backend/Dockerfile.identity` (Identity) e `frontend/Dockerfile`. Richiede il successo di Build e di tutti i job di test.
   - Su pull request le immagini vengono solo costruite (nessuna pubblicazione).
   - Su push verso `main` le immagini vengono pubblicate su GHCR come `ghcr.io/<owner>/<repo>/hackhub-backend`, `ghcr.io/<owner>/<repo>/hackhub-identity` e `ghcr.io/<owner>/<repo>/hackhub-frontend`, con tag `latest`, nome del branch e SHA del commit. Usa il `GITHUB_TOKEN` (permesso `packages: write`), nessun segreto aggiuntivo.

Il deploy non è ancora automatizzato: l'applicazione continua a essere avviata in locale con Docker Compose.

Per riprodurre i controlli della pipeline in locale:

```bash
cd Backend && npm ci && npm run test:coverage && npm run test:identity
cd ../frontend && npm ci && npm run build -- --configuration production && npx ng test --watch=false
docker build -t hackhub-backend ./Backend
docker build -f ./Backend/Dockerfile.identity -t hackhub-identity ./Backend
docker build -t hackhub-frontend ./frontend
```
