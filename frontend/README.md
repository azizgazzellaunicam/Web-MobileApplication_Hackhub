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

Avviare prima il backend:

```bash
cd ..\Backend
npm install
npm start
```

In un secondo terminale, dalla cartella `frontend`:

```bash
npm install
npm start
```

L'applicazione sarà disponibile su `http://localhost:4200`.

## Comunicazione con il backend

Il frontend invia le richieste agli endpoint `/api/...`. Durante lo sviluppo,
il proxy Angular definito in `proxy.config.json` inoltra le richieste a
`http://localhost:3000`.

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