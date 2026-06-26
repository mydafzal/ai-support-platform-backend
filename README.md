# CustomerBot AI Backend

CustomerBot AI Backend is a multi-tenant backend for AI-powered customer support automation. It manages business workspaces, chat widgets, training documents, calls, subscriptions, integrations, and LangChain/LangGraph-based agent workflows.

The project is designed as the backend layer for a configurable customer-service platform that can ingest business knowledge and expose AI chat, voice, meeting scheduling, CRM, and support workflows.

## Highlights

- Express.js API with a modular route/controller/service structure
- LangChain, LangGraph, OpenAI, and ChromaDB for AI agent workflows
- PostgreSQL persistence through Sequelize models and migrations
- Redis and Socket.IO support for real-time chat and state
- Training pipeline for documents, URLs, PDFs, and business data
- Multi-agent workflow modules for tool creation, supervisor routing, and meeting scheduling
- Integrations for HubSpot, Google Calendar/OAuth, Twilio, Stripe, email, Azure Blob Storage, S3, and Cloudinary
- Subscription, invitation, team group, call, chat widget, and business integration domains
- Docker support and database migrations/seeders

## Tech Stack

- Node.js
- Express
- Sequelize
- PostgreSQL
- Redis
- Socket.IO
- LangChain / LangGraph
- OpenAI
- ChromaDB
- Stripe
- Twilio
- HubSpot API
- Google APIs
- AWS S3 / Azure Blob Storage

## Architecture

```text
src/
  controllers/          API controllers and AI workflow controllers
  routes/               REST endpoints for auth, chat, calls, training, billing, users
  integrations/         external services such as CRM, storage, calendar, Redis, email
  services/             domain services for subscriptions, pricing, training, summaries
  eventHandlers/        Socket.IO chat and user events
  validators/           request validation

migrations/             Sequelize database migrations
models/                 Sequelize models
config/                 database and environment configuration
```

## Local Development

Install dependencies:

```bash
npm install
```

Start supporting services:

```bash
chroma run
redis-stack-server
```

Run migrations and seeders:

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Start the API:

```bash
npm run start:dev
```

## Environment

Create a local `.env` file from `.env.example` and provide values for database, Redis, OpenAI, ChromaDB, JWT, Stripe, storage, email, CRM, and telephony integrations.

## Security

Never commit real `.env` files, OAuth credential JSON, API keys, tokens, customer documents, or production exports. The repository is configured to ignore those files.

