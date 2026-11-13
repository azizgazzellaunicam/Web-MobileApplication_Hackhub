# HackHub

HackHub è una piattaforma per la gestione di hackathon, realizzata con Angular 22, Node.js, Express e MariaDB.

## Avvio locale (senza Docker)

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
- `HACKHUB_JWT_SECRET`
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

- `mariadb` con volume persistente `mariadb_data`;
- `backend` collegato a MariaDB via nome servizio `mariadb`;
- `frontend` (Nginx) che espone l’app Angular.

La persistenza dati è garantita dal volume MariaDB anche dopo riavvii dei container.

## Migrazione da SQLite

Se hai un vecchio file SQLite (`Backend/hackhub.sqlite`), puoi trasferire i dati:

```bash
cd Backend
npm run db:migrate:sqlite
```

Opzionale: `SQLITE_SOURCE_PATH=/path/al/file.sqlite`.

## Test

```bash
cd Backend
npm test                 # test backend (richiede MariaDB, vedi DB_*)
npm run test:coverage    # test backend + soglia di copertura righe ≥ 90%

cd ../frontend
npx ng test --watch=false  # test frontend (Vitest, nessun browser richiesto)
```

I test backend usano MariaDB (`DB_*`). Un MariaDB temporaneo per i test in locale:

```bash
docker run -d --name hackhub-test-db -p 127.0.0.1:3307:3306 \
  -e MARIADB_DATABASE=hackhub_test -e MARIADB_USER=hackhub \
  -e MARIADB_PASSWORD=hackhub -e MARIADB_ROOT_PASSWORD=root mariadb:11.8
DB_PORT=3307 DB_PASSWORD=hackhub DB_NAME=hackhub_test npm run test:coverage
docker rm -f hackhub-test-db
```

## CI/CD (GitHub Actions)

Il workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) viene eseguito automaticamente su push e pull request verso `main` (ed è avviabile manualmente con `workflow_dispatch`). È composto da tre job in sequenza:

1. **Build** – installazione delle dipendenze di `Backend` e `frontend` (`npm ci`) e build Angular di produzione; la build è caricata come artifact `frontend-dist`.
2. **Test** – avvia un MariaDB 11.8 come service container, esegue i test backend con soglia di copertura (`npm run test:coverage`) e i test frontend (`npx ng test --watch=false`). Richiede il successo della fase Build.
3. **Package** – costruisce le immagini Docker di `Backend/Dockerfile` e `frontend/Dockerfile`. Richiede il successo di Build e Test.
   - Su pull request le immagini vengono solo costruite (nessuna pubblicazione).
   - Su push verso `main` le immagini vengono pubblicate su GHCR come `ghcr.io/<owner>/<repo>/hackhub-backend` e `ghcr.io/<owner>/<repo>/hackhub-frontend`, con tag `latest`, nome del branch e SHA del commit. Usa il `GITHUB_TOKEN` (permesso `packages: write`), nessun segreto aggiuntivo.

Il deploy non è ancora automatizzato: l'applicazione continua a essere avviata in locale con Docker Compose.

Per riprodurre i controlli della pipeline in locale:

```bash
cd Backend && npm ci && npm run test:coverage
cd ../frontend && npm ci && npm run build -- --configuration production && npx ng test --watch=false
docker build -t hackhub-backend ./Backend
docker build -t hackhub-frontend ./frontend
```
