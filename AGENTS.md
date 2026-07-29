# tapt-api

This file provides context about the project for AI assistants.

## Project Overview

- **Ecosystem**: Typescript

## Tech Stack

- **Runtime**: node
- **Package Manager**: npm

### Backend

- Framework: nestjs
- API: ts-rest
- Validation: zod

### Database

- Database: postgres
- ORM: prisma

### Additional Features

- Email: sendgrid (infra/email — Global module via nestjs)
- Domain Events: @nestjs/event-emitter (EventEmitter2)
- Realtime: socket-io (infra/gateway — wired with AuthModule, Redis pub/sub adapter)
- Feature Flags: growthbook (infra/feature-flags — Global module)
- File Storage: cloudinary (infra/storage — Global module)
- Job Queue: bullmq (infra/queue)
- Caching: redis
- Logging: winston (nest-winston, WINSTON_MODULE_PROVIDER)
- Observability: sentry (infra/sentry — Global module, instrument.ts)
- Rate Limiting: @nestjs/throttler + Redis (APP_GUARD)
- API Docs: @nestjs/swagger (production-gated)
- Security: helmet (enterprise CSP, Swagger-compatible)

## Project Structure

```
tapt-api/
├── apps/
│   └── server/      # Backend API
│       └── src/
│           ├── common/            # Shared interceptors, filters, errors
│           │   └── interceptors/  # LoggingInterceptor (global)
│           ├── infra/
│           │   ├── email/         # SendGrid module (Global)
│           │   ├── feature-flags/ # GrowthBook module (Global)
│           │   ├── gateway/       # Socket.io gateway (Redis pub/sub adapter)
│           │   ├── logger/        # Winston config (nest-winston)
│           │   ├── queue/         # BullMQ queue + processors (email, notification)
│           │   ├── sentry/        # Sentry module (Global)
│           │   └── storage/       # Cloudinary module (Global)
│           ├── instrument.ts      # Sentry.init (first import in main.ts)
│           └── main.ts            # Bootstrap — prefix, versioning, Swagger, helmet, CORS
├── packages/
│   ├── api/         # API layer (ts-rest contract + shared event schemas for mobile)
│   ├── config/      # Shared config (tsconfig, biome)
│   ├── db/          # Database schema (Prisma)
│   └── env/         # Zod-validated env (server.ts, web.ts, native.ts)
```

## Common Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push database schema
- `npm run db:studio` - Open database UI

## Maintenance

Keep AGENTS.md updated when:

- Adding/removing dependencies
- Changing project structure
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
