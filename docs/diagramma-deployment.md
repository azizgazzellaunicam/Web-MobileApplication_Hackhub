# Diagramma deployment

Il diagramma rappresenta il deployment locale con Docker Compose, la rete tra i servizi e i volumi persistenti.

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

La porta frontend predefinita è `80` e può essere modificata con `FRONTEND_PORT`. Le porte dei database e di RabbitMQ sono pubblicate solo su `127.0.0.1`; backend e Identity comunicano sulla rete Docker. Per configurazione e comandi di avvio consultare il [README principale](../README.md#avvio-locale-con-docker-compose).