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
| POST | `/api/auth/refresh` | Rinnova la sessione autenticata |
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

Gli endpoint protetti accettano l'access token JWT in cookie `hackhub_access`
oppure nell'header:

```text
Authorization: Bearer <token>
```

Il login e la registrazione impostano due cookie `HttpOnly`:

- `hackhub_access`: access token JWT (durata breve, predefinita `15m`);
- `hackhub_refresh`: refresh token opaco (predefinita `7 giorni`, path `/api/auth`).

Entrambi usano `SameSite=Lax`; in produzione includono `Secure`.
La risposta JSON non espone mai i token. Il middleware continua ad accettare
anche `Authorization: Bearer` per integrazioni che ricevono l'access token da
un canale separato.

## Token e persistenza

I refresh token sono memorizzati nella tabella SQLite `refresh_tokens`.
Il database conserva solo l'hash SHA-256 del refresh token, l'utente associato,
scadenza, stato di revoca, famiglia e collegamento di rotazione.

- il login crea una coppia access/refresh e imposta i cookie `HttpOnly`;
- l'access token viene verificato localmente (firma, algoritmo, issuer/audience, exp)
  senza query SQLite per ogni richiesta;
- `POST /api/auth/refresh` ruota il refresh token in modo atomico;
- il riuso di un refresh già ruotato invalida la famiglia del token;
- il logout revoca il refresh token corrente e cancella entrambi i cookie.

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
- `HACKHUB_JWT_SECRET`: chiave JWT di almeno 32 caratteri; obbligatoria in
  produzione;
- `HACKHUB_ACCESS_TOKEN_TTL`: durata del JWT access token, predefinita a `15m`;
- `HACKHUB_REFRESH_TOKEN_TTL_SECONDS`: durata del refresh token in secondi,
  predefinita a `604800` (7 giorni).

In sviluppo, se `HACKHUB_JWT_SECRET` non è impostata, il backend genera una
chiave casuale temporanea e la stampa come avviso. I token diventano invalidi
al riavvio del processo. Per mantenere le sessioni, impostare comunque una
chiave persistente, ad esempio in PowerShell:

```powershell
$env:HACKHUB_JWT_SECRET = 'inserire-una-chiave-casuale-di-almeno-32-caratteri'
npm start
```
- `HACKHUB_JWT_ISSUER`: issuer del JWT, predefinito `hackhub-api`;
- `HACKHUB_JWT_AUDIENCE`: audience del JWT, predefinito `hackhub-web`;
- `NODE_ENV=production`: abilita il flag `Secure` dei cookie auth.

## Test

```bash
npm test
```

I test utilizzano un database temporaneo e verificano autenticazione JWT,
refresh con rotazione/revoca, autorizzazioni e accesso ai dati.