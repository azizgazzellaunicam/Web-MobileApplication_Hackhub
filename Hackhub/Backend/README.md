# HackHub Backend

Backend REST di HackHub, realizzato con Node.js, Express e SQLite.

Il server gestisce:

- registrazione, accesso e profili degli utenti;
- ruoli e autorizzazioni;
- team e inviti;
- hackathon e iscrizioni;
- sottomissioni e valutazioni;
- classifiche e vincitori;
- notifiche;
- richieste di supporto e call con i mentori.

Le API utilizzano richieste e risposte in formato JSON.

## Tecnologie

- Node.js
- Express 5
- SQLite
- JavaScript
- `node:test` per i test

## Struttura

Il codice si trova nella cartella `src`:

- `server.js`: avvia il server HTTP;
- `app.js`: configura Express, database, middleware e route;
- `controller`: definisce gli endpoint REST;
- `service`: contiene la logica applicativa;
- `repository`: gestisce l'accesso al database;
- `database`: inizializza, aggiorna e popola lo schema SQLite;
- `middleware`: autenticazione e gestione degli errori;
- `adapter`: integrazioni simulate per pagamenti e calendario;
- `strategy`: logiche specifiche, come la selezione del vincitore.

Il database predefinito è `hackhub.sqlite`.

## Avvio

Dalla cartella `Backend`:

```bash
npm install
npm start
```

Il server viene avviato sulla porta `3000`.

Il frontend Angular utilizza il proxy di sviluppo per inoltrare le richieste
`/api` al backend.

## API principali

| Metodo | Endpoint | Descrizione |
| --- | --- | --- |
| GET | `/health` | Verifica lo stato del server |
| POST | `/api/auth/register` | Registra un nuovo utente |
| POST | `/api/auth/login` | Esegue l'accesso |
| POST | `/api/auth/logout` | Chiude la sessione |
| GET/PUT | `/api/auth/profile` | Legge o aggiorna il profilo |
| GET | `/api/hackathons` | Restituisce gli hackathon |
| POST | `/api/hackathons` | Crea un hackathon |
| PUT/DELETE | `/api/hackathons/:id` | Modifica o elimina un hackathon |
| POST | `/api/hackathons/:id/registrations` | Iscrive un team |
| POST | `/api/hackathons/:id/submissions` | Invia una sottomissione |
| GET | `/api/submissions/mine` | Restituisce le sottomissioni dell'utente |
| POST | `/api/submissions/:id/evaluations` | Registra una valutazione |
| GET/POST | `/api/teams` | Consulta o crea un team |
| GET | `/api/profile/wins` | Restituisce gli hackathon vinti |
| GET | `/api/notifications` | Restituisce le notifiche |
| GET | `/api/hackathons/:id/ranking` | Restituisce la classifica |

Gli endpoint protetti richiedono un token di sessione nell'header:

```text
Authorization: Bearer <token>
```

## Configurazione

Le principali variabili d'ambiente sono:

- `PORT`: porta del server, predefinita a `3000`;
- `HACKHUB_DB_PATH`: percorso del database SQLite;
- `HACKHUB_SEED_DEMO`: abilita i dati demo in sviluppo o nei test;
- `HACKHUB_DEMO_*_PASSWORD`: password degli account demo.

## Test

```bash
npm test
```

I test utilizzano un database temporaneo e verificano autenticazione,
autorizzazioni e accesso ai dati.