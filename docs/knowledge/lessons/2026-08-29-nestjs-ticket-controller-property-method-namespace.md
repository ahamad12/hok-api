---
date: 2026-08-29
description: "NestJS controllers with ts-rest inject use-case instances as properties (private readonly createTicket: CreateTicketUseCase) that share the class…"
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-08-28T19:23:46.553Z"
scope: project
projects: ["tapt-api"]
aliases: ["NestJS ticket controller property/method namespace collision requires UseCase suffix"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/08/2026-08-29 NestJS ticket controller property method namespace.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# NestJS ticket controller property/method namespace collision requires UseCase suffix

NestJS controllers with ts-rest inject use-case instances as properties (private readonly createTicket: CreateTicketUseCase) that share the class namespace with handler methods (create(@CurrentUser) { return tsRestHandler(ticketContract.create ...)}). Bare property names collide with method names (TS2300 Duplicate identifier getMessages vs getMessages()). The vault convention in task/category/delivery controllers is to suffix constructor properties with UseCase (createTicketUseCase, getMessagesUseCase) and keep handler names 1:1 with contract keys (getMessages ↔ ticketContract.getMessages). TsRestHandler binding is contract object reference, not method name string, so renaming handler to listMessages would compile but break 30+ handler 1:1 convention.

## How this is known

Verified against ticket.controller.ts:26-35 9 bare vs task.controller.ts:21-29 7 suffixed, build TS2300 Duplicate identifier getMessages, and @TsRestHandler(ticketContract.getMessages) object reference not method-name string at package contract.
