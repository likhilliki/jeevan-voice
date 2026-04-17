# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Jeevan Voice (Voice AI for low-literacy users in India)

- **Frontend** (`artifacts/jeevan-voice`): React + Vite + Wouter, warm saffron palette. Pages: Home (`/`), Demo (`/demo`), History (`/history/:userId`).
- **Backend** (`artifacts/api-server`): Express + TypeScript on port 8080. Routes:
  - `POST /api/vapi-webhook` — Vapi voice integration
  - `POST /api/query` — text query (body: `{userId, text, language}`)
  - `GET /api/memory/:userId` — list past conversations
  - `DELETE /api/memory/:userId` — clear memory
  - `GET /api/healthz` — health/status
- **AI provider**: Google Gemini via `@google/genai` SDK. Reads `GEMINI_API_KEY` or `OPENAI_API_KEY` (the user provided their Gemini key under `OPENAI_API_KEY`).
  - Chat: `gemini-2.5-flash`
  - Embeddings: `gemini-embedding-001` with `outputDimensionality: 768`
  - Built-in retry with exponential backoff for 429/500/503
- **Vector memory**: Qdrant Cloud (`QDRANT_URL`, `QDRANT_API_KEY`). Collection `user_memory`, 768 dims, cosine distance, payload index on `userId` (auto-created).
- **Intent + emergency detection**: rule-based keywords across English / Hindi (script + romanized) / Kannada in `services/intentDetector.ts`. Emergency intent short-circuits the LLM and returns 108 ambulance instructions immediately.
- **Key files**: `services/agent.ts` (orchestration), `services/openai.ts` (Gemini client, despite filename), `services/qdrant.ts`, `services/intentDetector.ts`, `routes/voice.ts`.

