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

Per avviare l'intero progetto in locale, inclusi i due database, RabbitMQ e
Identity, seguire il [README principale](../README.md#avvio-locale-con-docker-compose).
La sezione [sviluppo con servizi Node locali](../README.md#sviluppo-con-servizi-node-locali)
descrive le variabili distinte per Identity e backend e l'ordine di avvio.
I processi Node non caricano automaticamente `.env`.

`GET /health` verifica sia il processo HTTP sia la raggiungibilità MariaDB (`SELECT 1`).

## Messaggistica (RabbitMQ)

Identity pubblica gli eventi su RabbitMQ e il backend li consuma. Il flusso Outbox → RabbitMQ → Inbox, con topologia, retry e dead-letter, è descritto in [../docs/messaggistica.md](../docs/messaggistica.md).

Variabile richiesta da Identity e dal backend:

- `RABBITMQ_URL` (formato `amqp://utente:password@host:5672`). La password non deve contenere caratteri speciali URL (`@`, `:`, `/`, `%`, `#`).

Il consumer della coda `hackhub.backend.events` viene avviato da `Backend/src/server.js`. `createApp` non lo avvia, quindi `api.test.js` e `role-workflow.test.js` non competono per la coda.

## Test

Eseguire i test usando database e broker RabbitMQ dedicati: la suite modifica
i dati e le code. La procedura completa per creare servizi di test isolati e
configurare le variabili è nel [README principale](../README.md#test).

```bash
npm test
```

I test richiedono due database MariaDB configurati tramite le variabili `DB_*`
e un broker RabbitMQ indicato da `RABBITMQ_URL`.
