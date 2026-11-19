# Diagramma architetturale

Il diagramma mostra i componenti applicativi di HackHub e le comunicazioni tra frontend, backend, Identity, database e broker.

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

Il backend comprende i moduli Team, Hackathon, Competition, Support e Notification. Identity gestisce autenticazione e utenti nel proprio database. Per il flusso asincrono, i retry e la dead-letter queue, consultare [Messaggistica](messaggistica.md).