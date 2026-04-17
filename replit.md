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
- **AI provider**: Anthropic Claude via Replit AI Integrations (`AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, auto-configured by Replit, billed to Replit credits — no user key required).
  - Chat: `claude-haiku-4-5` with tool-use (forced `respond_to_user` tool) for structured `{reply, actions[]}` output.
  - Built-in retry with exponential backoff for 429/500/503.
- **User memory**: Simple in-memory FIFO of last 10 messages per `userId` in `services/qdrant.ts` (file kept as-is for backward-compatible imports). Anthropic does not provide embeddings, and Qdrant is no longer used at runtime. Memory resets on server restart — acceptable for the demo.
- **Voice & actions**:
  - Frontend uses the browser Web Speech API (`startListening` / `speak` in `lib/voice.ts`) for input + TTS reply in en-IN / hi-IN / kn-IN. No external STT key required.
  - Each Claude reply ships 1-3 sanitized action buttons (`type: call | map | directions | link`). Server-side `sanitizeActions` enforces phone digit-only, https-only links on a `.gov.in` allowlist (pmjay, pmkisan, pmjdy, india.gov.in, mygov, janaushadhi, umang, etc.) to prevent prompt-injection of unsafe URLs. `<ActionButtons>` renders them as anchors to `tel:`, Google Maps, or the validated URL.
- **Intent + emergency detection**: rule-based keywords across English / Hindi (script + romanized) / Kannada in `services/intentDetector.ts`. Emergency intent short-circuits the LLM, returns hardcoded 108 ambulance reply + map action.
- **Key files**: `services/agent.ts` (orchestration), `services/openai.ts` (Anthropic client + `sanitizeActions`, despite filename), `services/qdrant.ts` (in-memory store), `services/intentDetector.ts`, `routes/voice.ts`, `artifacts/jeevan-voice/src/lib/voice.ts`, `artifacts/jeevan-voice/src/components/action-buttons.tsx`.

