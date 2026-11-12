# HackHub Backend

Backend REST di HackHub, realizzato con Node.js, Express e MariaDB (InnoDB).

## Tecnologie

- Node.js
- Express 5
- MariaDB
- `mysql2/promise`
- JavaScript
- `node:test` per i test

## Configurazione database

Il backend usa un connection pool MariaDB configurato solo via variabili d'ambiente:

- `DB_HOST`
- `DB_PORT` (default `3306`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_POOL_SIZE` (default `10`)

Le credenziali non sono hardcoded nel codice.

## Schema e migrazioni

All’avvio:

1. crea lo schema con `CREATE TABLE IF NOT EXISTS`;
2. applica migrazioni idempotenti (`status_override`, indice team unico);
3. esegue i controlli di sicurezza startup;
4. popola eventuali dati demo in sviluppo/test.

## Migrazione dati SQLite → MariaDB

È disponibile lo script:

```bash
npm run db:migrate:sqlite
```

Variabile opzionale:

- `SQLITE_SOURCE_PATH` (default `Backend/hackhub.sqlite`)

Lo script preserva ID e relazioni, usa insert idempotenti e riallinea gli `AUTO_INCREMENT`.

## Avvio

```bash
npm install
npm start
```

`GET /health` verifica sia il processo HTTP sia la raggiungibilità MariaDB (`SELECT 1`).

## Test

```bash
npm test
```

I test usano MariaDB e richiedono le variabili `DB_*` configurate.
