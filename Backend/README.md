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

In sviluppo, l'avvio crea o aggiorna gli account demo automaticamente:

| Ruolo | Email | Password |
| --- | --- | --- |
| Utente | `mario@hackhub.it` | `password` |
| Organizzatore | `admin@hackhub.it` | `password` |
| Giudice | `giudice@hackhub.it` | `password` |
| Mentore | `mentore@hackhub.it` | `password` |

Questi account sono disponibili solo in sviluppo e non vengono creati in
produzione.

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

Il login e la registrazione impostano il cookie `hackhub_session` con gli
attributi `HttpOnly`, `SameSite=Lax` e `Path=/`; in produzione include anche
`Secure`. La risposta JSON non espone il token. I client browser devono inviare
il cookie; il middleware continua ad accettare anche `Authorization: Bearer`
per integrazioni che dispongono del token tramite un canale separato.

## Sessioni persistenti

Le sessioni sono memorizzate nella tabella SQLite `sessions`. Il database
conserva solo l'hash SHA-256 del token, l'utente associato, la data di
scadenza e la data di creazione. Le sessioni durano otto ore.

- il login crea una sessione e imposta il cookie `HttpOnly`;
- il middleware elimina le sessioni scadute e rifiuta i token non validi;
- il logout invalida la sessione nel database e cancella il cookie;
- le sessioni valide sopravvivono al riavvio del server se il file SQLite
  resta sullo storage persistente.

Per il deployment, impostare `HACKHUB_DB_PATH` su un percorso persistente e
servire l'applicazione in HTTPS. In produzione il cookie richiede HTTPS
perché viene marcato `Secure`. Non usare un database temporaneo o effimero se
si vuole mantenere l'autenticazione dopo un riavvio o un redeploy.

## Configurazione

Le principali variabili d'ambiente sono:

- `PORT`: porta del server, predefinita a `3000`;
- `HACKHUB_DB_PATH`: percorso del database SQLite;
- `HACKHUB_SEED_DEMO=false`: disabilita il seed demo in sviluppo;
- `HACKHUB_DEMO_*_PASSWORD`: sostituisce le password demo predefinite.
- `NODE_ENV=production`: abilita il flag `Secure` del cookie di sessione.

## Test

```bash
npm test
```

I test utilizzano un database temporaneo e verificano autenticazione,
autorizzazioni e accesso ai dati.