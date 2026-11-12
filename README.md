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
npm test
```

I test backend usano MariaDB (`DB_*`).
