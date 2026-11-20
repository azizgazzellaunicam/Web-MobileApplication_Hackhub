# HackHub

HackHub è una piattaforma per la gestione di hackathon, realizzata con Angular 22, Node.js, Express e MariaDB.

## Avvio rapido

1. Avviare Docker Desktop (o Docker Engine).
2. Nella cartella del progetto, copiare il file di esempio:

```powershell
Copy-Item .env.example .env
```

Aprire `.env`, inserire le password e i secret richiesti seguendo la sezione [Configurazione `.env`](#configurazione-env-per-docker-compose) più avanti nel README.
3. Avviare l'applicazione:

```powershell
docker compose up --build -d
```

4. Aprire `http://localhost` nel browser.

Per fermare l'applicazione usare `docker compose down`. **Non usare `docker compose down -v`**: cancella anche i dati salvati.

## Credenziali demo

| Ruolo | Email | Password |
| --- | --- | --- |
| ORGANIZER | `organizer.demo@hackhub.it` | `accountTest!` |
| JUDGE | `judge.demo@hackhub.it` | `accountTest!` |
| MENTOR | `mentor.demo@hackhub.it` | `accountTest!` |

Un account standard (`USER`) non è precreato: registrarsi dalla pagina di registrazione dell'interfaccia.

---

# Documentazione tecnica

Questa sezione descrive architettura, configurazione, test e CI/CD. Non serve per avviare l'applicazione.

## Architettura

```mermaid
flowchart LR
  Browser[Browser] --> Frontend[Frontend Angular / PWA]
  Frontend -->|/api/auth| Identity[Identity Service]
  Frontend -->|/api| Backend[Backend Express]
  Backend -->|HTTP interno con service token| Identity
  Identity --> IdentityDB[(MariaDB Identity)]
  Backend --> DomainDB[(MariaDB dominio)]
  Identity -->|Outbox / relay| RabbitMQ[RabbitMQ]
  RabbitMQ -->|Consumer / Inbox| Backend
```

Il backend contiene i moduli Team, Hackathon, Competition, Support e Notification. Identity gestisce utenti, sessioni e token nel proprio database. Il [diagramma architetturale](docs/diagramma-architetturale.md) e i dettagli su [messaggistica, retry e dead-letter](docs/messaggistica.md) sono disponibili nella documentazione.

## Deployment locale con Docker Compose

Il deployment seguente usa Docker Compose su una sola macchina. Le porte pubblicate sono vincolate a `127.0.0.1`, quindi accessibili solo dalla macchina locale.

```mermaid
flowchart TB
  Browser[Browser sulla macchina locale] -->|127.0.0.1:80| Frontend
  subgraph Host[Macchina locale: Docker Compose]
    subgraph Network[Rete Docker hackhub]
      Frontend[Frontend: Nginx + Angular]
      Identity[Identity: porta 3001]
      Backend[Backend: porta 3000]
      IdentityDB[(MariaDB Identity)]
      DomainDB[(MariaDB dominio)]
      RabbitMQ[RabbitMQ]
      Frontend -->|/api/auth| Identity
      Frontend -->|/api| Backend
      Backend -->|HTTP interno| Identity
      Identity --> IdentityDB
      Backend --> DomainDB
      Identity --> RabbitMQ
      RabbitMQ --> Backend
    end
    IdentityDB --- IdentityVolume[(Volume identity_mariadb_data)]
    DomainDB --- DomainVolume[(Volume mariadb_data)]
    RabbitMQ --- RabbitVolume[(Volume rabbitmq_data)]
  end
```

MariaDB è raggiungibile dall'host solo su `127.0.0.1:3306` e `127.0.0.1:3307`; RabbitMQ solo su `127.0.0.1:5672` e la console su `127.0.0.1:15672`. Le porte host sono configurabili in `.env`; backend e Identity sono raggiungibili solo sulla rete Docker. La porta frontend predefinita è `80`, modificabile con `FRONTEND_PORT`. Il [diagramma di deployment](docs/diagramma-deployment.md) descrive i container, la rete e i volumi.

## Configurazione `.env` per Docker Compose

Prima di avviare lo stack il file `.env` deve contenere i valori seguenti. I comandi di avvio sono in [Avvio rapido](#avvio-rapido). Eseguire i comandi dalla root del repository; su Windows usare PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Su Linux/macOS, creare il file solo se non esiste: `test -e .env || cp .env.example .env`. Aprire `.env` e valorizzare tutti i seguenti campi vuoti:

- `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `IDENTITY_DB_PASSWORD`, `IDENTITY_DB_ROOT_PASSWORD` e `RABBITMQ_PASSWORD`.
- `HACKHUB_JWT_SECRET` e `HACKHUB_SERVICE_TOKEN`, ciascuno di almeno 32 caratteri. Usare valori casuali e distinti, senza pubblicarli.

Per `RABBITMQ_PASSWORD` usare caratteri alfanumerici o esadecimali: è inserita in un URL AMQP e caratteri speciali come `@`, `:`, `/`, `%` e `#` non sono supportati. `.env` è ignorato da Git. Le credenziali MariaDB e RabbitMQ inizializzano i volumi al primo avvio: cambiare `.env` successivamente non aggiorna automaticamente gli utenti già presenti.

Per validare la configurazione prima dell'avvio: `docker compose config --quiet`. Se si cambia `FRONTEND_PORT`, l'app è su `http://localhost:<FRONTEND_PORT>`. L'endpoint `/health` sulla stessa origine verifica backend e database di dominio. Compose usa `NODE_ENV=production` e disabilita i dati demo; le registrazioni creano utenti con ruolo `USER`. **Non usare `docker compose down -v` se si vogliono conservare i dati**.

## Sviluppo con servizi Node locali

Questa modalità usa Docker solo per i due MariaDB e RabbitMQ; i processi Identity, backend e frontend sono avviati separatamente. Richiede Node.js `^22.22.3`, `^24.15.0` oppure `>=26.0.0`, npm, Docker e il file `.env` compilato come sopra. I comandi sotto sono per PowerShell; avviare i servizi in terminali distinti.

1. Dalla root, avviare solo l'infrastruttura e installare le dipendenze:

```powershell
docker compose up -d mariadb identity-mariadb rabbitmq
cd Backend
npm ci
cd ../frontend
npm ci
```

2. Nel terminale Identity, dalla root, sostituire i segnaposto con i corrispondenti valori di `.env`:

```powershell
cd Backend
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3307'
$env:DB_NAME = '<IDENTITY_DB_NAME>'
$env:DB_USER = '<IDENTITY_DB_USER>'
$env:DB_PASSWORD = '<IDENTITY_DB_PASSWORD>'
$env:RABBITMQ_URL = 'amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@127.0.0.1:5672'
$env:HACKHUB_SEED_DEMO = 'false'
node --env-file=../.env src/identity-server.js
```

3. In un **nuovo terminale** backend, dalla root, sostituire il segnaposto AMQP con gli stessi valori:

```powershell
cd Backend
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:IDENTITY_SERVICE_URL = 'http://127.0.0.1:3001'
$env:RABBITMQ_URL = 'amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@127.0.0.1:5672'
$env:HACKHUB_SEED_DEMO = 'false'
node --env-file=../.env src/server.js
```

4. In un terzo terminale, dalla root, avviare Angular e aprire `http://localhost:4200`:

```powershell
cd frontend
npm start
```

`node --env-file=../.env` carica JWT, service token e credenziali del database di dominio dal file; le variabili già impostate nel terminale hanno precedenza. Se sono state cambiate le porte host DB o RabbitMQ in `.env`, adattare i comandi. Il proxy Angular inoltra `/api/auth/**` a Identity sulla porta 3001 e `/api/**` al backend sulla porta 3000. I processi Node diretti non caricano `.env` automaticamente. In questa procedura il seed demo è disabilitato; i dati demo mostrati dall'interfaccia di sviluppo non corrispondono necessariamente a utenti presenti nel database.

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

Lo stack avvia:

- `mariadb` con volume persistente `mariadb_data`, per il dominio (team, hackathon, competizione, supporto, notifiche);
- `identity-mariadb` con volume `identity_mariadb_data`, dedicato al solo servizio Identity (`hackhub_identity`);
- `identity` (immagine da `Backend/Dockerfile.identity`, `src/identity-server.js`), che gestisce utenti, sessioni e token. È raggiungibile solo sulla rete Docker;
- `rabbitmq` (`rabbitmq:4-management`) con volume `rabbitmq_data`, broker degli eventi tra Identity e backend. La console di gestione è su `127.0.0.1:15672`;
- `backend` (monolite di dominio) collegato a `mariadb`, a `rabbitmq` (consumer degli eventi) e a `identity` tramite `IDENTITY_SERVICE_URL`;
- `frontend` (Nginx) che espone l’app Angular. Nginx instrada `/api/auth/*` a `identity` e il resto di `/api/*` a `backend`.

La persistenza dati è garantita dai volumi MariaDB anche dopo riavvii dei container.

## Architettura backend

Il backend è diviso in moduli con confini di dominio. Il servizio **Identity** dispone di un database proprio; gli altri moduli sono nel monolite e accedono agli utenti tramite le API interne di Identity.

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

## Comunicazione tra servizi

- **Chiamate sincrone**: il monolite chiama Identity via HTTP interno (`/internal/*`), autenticato con `x-hackhub-service-token` (`HACKHUB_SERVICE_TOKEN`), condiviso tra i servizi.
- **Eventi (Outbox → RabbitMQ → Inbox)**: Identity scrive gli eventi nella tabella `outbox_events` nella stessa transazione della modifica che li produce. Un relay li pubblica su RabbitMQ (exchange `hackhub.events`, con conferma del publisher) ogni 2 secondi, in ordine. Il backend consuma la coda `hackhub.backend.events` e registra ogni evento in `inbox_events` (chiave `event_id`) nella stessa transazione dei suoi effetti. Il flusso dettagliato, con retry, dead-letter queue e diagrammi, è in [docs/messaggistica.md](docs/messaggistica.md).
- **Retry e dead-letter**: il consumer ritenta un evento il cui handler fallisce con attese di 1s, 2s, 4s, 8s e 16s (ogni attesa è una coda con TTL, senza bloccare gli altri eventi). Dopo cinque retry l'evento va nella coda `hackhub.backend.events.dead`, con `x-attempts` e `x-last-error`. Un messaggio malformato va subito in dead-letter. Il relay dell'Outbox ritenta la pubblicazione con le stesse attese e marca `dead_lettered_at` dopo cinque retry.
- Garanzie: consegna *at-least-once* con inbox idempotente, non *exactly-once*. Un duplicato viene ignorato dall'Inbox. I retry possono far arrivare un evento dopo quelli successivi: il backend non deve dipendere dall'ordine tra eventi diversi.
- **Evento `user.registered`**: Identity lo emette alla registrazione con `userId`, `name` ed `email`; il monolite lo registra nell'Inbox.
- Variabile richiesta da Identity e dal backend: `RABBITMQ_URL`.
- **Compensazione nel monolite**: l'invito a un team crea l'invito e poi la notifica, che usano connessioni diverse. Se la notifica fallisce, l'invito appena creato viene cancellato e la richiesta fallisce.
- **Identity non disponibile**: le chiamate sincrone del monolite a Identity rispondono `502` senza scrivere nulla in locale.

## Test

I test backend cancellano e ricreano dati di test e modificano le code RabbitMQ: **non puntarli ai database o al broker dell'applicazione**. I comandi seguenti, per PowerShell dalla root del repository, creano servizi temporanei separati sulle porte locali `13306` e `15673`; verificare che porte e nomi dei container non siano già in uso. Le password mostrate sono soltanto per questi container di test locali.

```powershell
docker run -d --name hackhub-test-db -p 127.0.0.1:13306:3306 -e MARIADB_DATABASE=hackhub_test -e MARIADB_USER=hackhub -e MARIADB_PASSWORD=hackhub -e MARIADB_ROOT_PASSWORD=root mariadb:11.8
docker run -d --name hackhub-test-rabbitmq -p 127.0.0.1:15673:5672 -e RABBITMQ_DEFAULT_USER=hackhub -e RABBITMQ_DEFAULT_PASS=hackhub rabbitmq:4-management
```

Attendere che i servizi siano pronti, verificando `docker logs hackhub-test-db` e `docker logs hackhub-test-rabbitmq`, quindi creare il secondo database e avviare i test:

```powershell
docker exec hackhub-test-db mariadb -uroot -proot -e "CREATE DATABASE hackhub_identity_test; GRANT ALL PRIVILEGES ON hackhub_identity_test.* TO 'hackhub'@'%';"
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '13306'
$env:DB_USER = 'hackhub'
$env:DB_PASSWORD = 'hackhub'
$env:DB_NAME = 'hackhub_test'
$env:RABBITMQ_URL = 'amqp://hackhub:hackhub@127.0.0.1:15673'
cd Backend
npm ci
npm test
npm run test:coverage
npm run test:identity
cd ../frontend
npm ci
npx ng test --watch=false
```

`test:identity` è un sottoinsieme della suite backend; `test:coverage` richiede copertura righe almeno del 90%. Al termine, dopo aver verificato che si tratti dei container temporanei creati sopra, eliminarli con `docker rm -f hackhub-test-db hackhub-test-rabbitmq`. Queste operazioni non riguardano i volumi di Compose.

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

L'applicazione viene avviata in locale con Docker Compose, come descritto in [Avvio rapido](#avvio-rapido) e nella sezione [configurazione `.env`](#configurazione-env-per-docker-compose).

Per riprodurre i controlli della pipeline in locale:

```bash
cd Backend && npm ci && npm run test:coverage && npm run test:identity
cd ../frontend && npm ci && npm run build -- --configuration production && npx ng test --watch=false
docker build -t hackhub-backend ./Backend
docker build -f ./Backend/Dockerfile.identity -t hackhub-identity ./Backend
docker build -t hackhub-frontend ./frontend
```
