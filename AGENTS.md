# tapt-api

This file provides context about the project for AI assistants.

## Where design decisions live

Design rationale for this project is recorded outside this repo, reachable through the `om` MCP server (vault at `C:/Users/Mr Rager/obsidian-mind`).

- **`search`** reaches the written record: why a choice was made, what was rejected, what a constraint was set against. **Start here.**
- **`expand`** shows a known note's links and backlinks, which is cheaper than searching again for its neighbourhood.
- **`recall`** returns short durable lessons scoped to this project (`tapt-api`). It is empty until sessions put things in it, so early on it returns nothing — that is *not* evidence the record is missing.
- **`health`** when something that should be there cannot be found. Every failure in this layer looks identical from outside (no results), and this tells them apart.

Consult the record before changing:

- the Prisma schema (`packages/db/prisma/schema/schema.prisma`) — money as `Int` cents, `@@unique([shopId,name])`, partial index `scratch_scan_events_pack_shift_active_key`, denormalized `License.current*` / `Delivery.totalPaidCents`
- token lifecycle (`tokenVersion` + Redis `tokenver:${userId}` + SHA-256 `refresh_tokens.token`) and `isUniqueViolation` / `isNotFound` single predicate
- the ts-rest contract (`packages/api/src/contracts/*` with `pathPrefix "/api/v1"`) — DTOs via `z.infer`, route order matters
- guarded `updateMany` + `$transaction` concurrency (delivery payments, scratch scans, dailySummary) and `Json` schema validation
- the infra boundaries (`infra/gateway` Redis adapter, `infra/queue` BullMQ, `infra/storage` Cloudinary)

If that record and this repo disagree, the record holds the *why*. Reconcile before changing behaviour.

**Say what came back, in whatever you write before implementing:** a plan, a design note, an issue comment. Name the recorded decisions the work rests on, anything you found that argues *against* the approach, and an explicit "nothing recorded on this" when the record is empty, which is a finding rather than a blank to skip.

## Recording what you learn

Two tools — picking the wrong one is the common mistake. The test is whether it would help someone working on a **different** project.

- **`remember`** stores a durable lesson: a constraint you discovered, a gotcha that cost time, a rule that generalises. Set `confidence` (`verified` / `inferred` / `unverified`) honestly. For something specific to this project use `scope: "project"` with `projects: ["tapt-api"]`. Reach for `scope: "platform"` before `"general"`.
- **`record_work`** files what happened *here*: changes, decisions and the alternatives rejected, what was learned, what is still open, how it was verified.

Vault details: `C:/Users/Mr Rager/obsidian-mind/CLAUDE.md` is the operating manual. `reference/tapt-api-codebase.md` is the codebase map. `brain/Patterns.md#TAPT`, `brain/Gotchas.md#TAPT`, `brain/Key Decisions.md` hold the durable rules.

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

## Database Notes

- `scratch_scan_events` enforces at most one ACTIVE (non-voided) scan per pack/date/shift via the partial unique index `scratch_scan_events_pack_shift_active_key` (migration `20260806120000_scratch_scan_active_shift_unique`). It is NOT in `schema.prisma` (`@@unique`/`@@index` can't express a partial `WHERE` clause); keep it in sync only through migrations. The repository translates the resulting P2002 to a `ConflictError` in `createScanAndFinishPackIfDepleted`.
- `suppliers` enforces one name per shop via `@@unique([shopId, name])` (migration `20260820_supplier_shop_name_unique`), mirroring `categories` and `shops`.
- `refresh_tokens.token` stores ONLY the SHA-256 hash of the raw refresh token (`token.service.ts` hashes before persisting); the raw value is returned once at generation time and is never stored or logged again. Never compare against, store, or log raw tokens elsewhere.

## Layering Conventions (Prisma error translation)

- Repositories are the ONLY layer that touches Prisma. The single definition of "this is a uniqueness conflict / not-found" lives in `apps/server/src/common/prisma/errors.ts` (`isUniqueViolation` for P2002, `isNotFound` for P2025 via shared `isPrismaErrorWithCode` preserving the `error is PrismaClientKnownRequestError` predicate); every repository wraps its `create`/`update` and translates a P2002 into a domain `ConflictError` (e.g. `category.repository.ts`, `supplier.repository.ts`, `user.repository.ts`). Repositories take real `Prisma.*CreateInput`/`*UpdateInput` types — no `Record<string, unknown>` + cast.
- Always import Prisma via `@tapt-api/db/prisma`, never `from "@prisma/client"` directly — `instanceof Prisma.PrismaClientKnownRequestError` silently fails across duplicate module instances even with correct `tsdown` externalization (`apps/server/tsdown.config.ts`).
- Use-cases must NOT import from `@tapt-api/db/prisma` and must not catch P2002 — they call the repository and let the already-translated `ConflictError` propagate. DTO shapes that overlap DB columns (e.g. shop `address`) are typed from the API contract (`z.infer<typeof shopAddressSchema>`), not from Prisma.
- Idempotent deletes absorb ONLY P2025 via `isNotFound`; every other failure propagates. No blanket `.catch(() => undefined)` and no preemptive `isForeignKeyViolation` (P2003) stub — add it only in the same commit as the first repository method that actually needs to distinguish P2003.
- The global exception filter's boundary fallbacks (P2002 → 409, P2025 → 404) are last-resort safety nets only; they should never fire for an anticipated conflict or a checked missing record.

## Development & Build Workflows

- **Dev runner is SWC-based** (`node --import @swc-node/register/esm-register`), NOT tsx: esbuild/tsx strip types without emitting `design:paramtypes`, which breaks NestJS constructor-based DI (the app fails to boot under tsx). `@swc-node/register` reads `tsconfig.json` and emits decorator metadata.
- **Production build (`tsdown`, `apps/server/tsdown.config.ts`)**: native-addon packages (`bcrypt`, `@sentry/profiling-node`) and `@prisma/*` are externalized and MUST stay external — bundling `node-gyp-build` inline breaks bcrypt's native loader at runtime (`No native build was found...`) and breaks `instanceof PrismaClientKnownRequestError` checks. Prisma's query-compiler WASM chunks load fine from `node_modules` at runtime. `npm run start` = `node dist/index.mjs`.
- **CI lint** (`npx biome check .`) only fails on errors; the repo's committed baseline has warnings only. Note: on Windows with `core.autocrlf=true`, local `biome check` shows spurious format errors from CRLF checkouts that do not occur in CI (LF checkout).

## Maintenance

Keep AGENTS.md updated when:

- Adding/removing dependencies
- Changing project structure
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
