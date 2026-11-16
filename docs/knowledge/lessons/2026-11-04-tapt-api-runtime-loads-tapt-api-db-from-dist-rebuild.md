---
date: 2026-11-04
description: "packages/db/package.json exports map \"types\" to ./src/*.ts but \"default\" to ./dist/src/*.js."
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-11-04T05:20:38.721Z"
scope: project
projects: ["tapt-api"]
aliases: ["tapt-api runtime loads @tapt-api/db from dist — rebuild after prisma generate"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/11/2026-11-04 tapt-api runtime loads @tapt-api db from dist — rebuild.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# tapt-api runtime loads @tapt-api/db from dist — rebuild after prisma generate

packages/db/package.json exports map "types" to ./src/*.ts but "default" to ./dist/src/*.js. tsc --noEmit and vitest read src (fresh generated client), while the running server (node --import @swc-node/register) loads dist, which holds a compiled copy of prisma/generated. After any schema change plus `prisma generate`, the server keeps the OLD client until `npm -w @tapt-api/db run build` (tsc -b) runs. Symptom: PrismaClientValidationError "Unknown argument <newField>" at runtime while typecheck and unit tests are green. Unit tests mock repositories, so only booting the app catches it. Also on this dev machine localhost:5432 is another Postgres, not the tapt-api-postgres container; for a bootable scratch DB run a throwaway postgres:16-alpine on another port.

## How this is known

Server rejected refreshToken.create({familyId}) with a stale-client validation error; after npm -w @tapt-api/db run build the same e2e script passed 26/26.
