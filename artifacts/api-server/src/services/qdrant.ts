import { logger } from "../lib/logger.js";

// Simple in-memory recent-messages store keyed by userId.
// Replaces the previous Qdrant vector store since the active LLM provider
// (Anthropic Claude via Replit AI Integrations) does not offer embeddings.
//
// This is intentionally lightweight for a demo: per-user FIFO of the last
// MAX_PER_USER messages. Memory is reset on server restart, which is fine
// for short conversational continuity.

const MAX_PER_USER = 10;

export interface MemoryEntry {
  id: string;
  text: string;
  timestamp: string;
  language: string;
  intent: string;
}

const store = new Map<string, MemoryEntry[]>();

let entryCounter = 0;
function nextId(): string {
  entryCounter += 1;
  return `mem_${Date.now()}_${entryCounter}`;
}

export async function initCollection(): Promise<void> {
  logger.info("In-memory user memory store initialized");
}

export async function upsertMemory(
  userId: string,
  text: string,
  _embedding: number[],
  metadata: {
    language: string;
    intent: string;
    timestamp: string;
  },
): Promise<void> {
  const entry: MemoryEntry = {
    id: nextId(),
    text,
    language: metadata.language,
    intent: metadata.intent,
    timestamp: metadata.timestamp,
  };

  const existing = store.get(userId) || [];
  existing.push(entry);
  // Keep only the most recent MAX_PER_USER entries.
  while (existing.length > MAX_PER_USER) existing.shift();
  store.set(userId, existing);

  logger.info(
    { userId, intent: metadata.intent, total: existing.length },
    "Memory stored",
  );
}

export async function searchMemory(
  userId: string,
  _queryEmbedding: number[],
  limit = 5,
): Promise<
  Array<MemoryEntry & { score: number }>
> {
  const entries = store.get(userId) || [];
  // Return most recent `limit` messages, newest first, with a constant score
  // above the agent's 0.5 threshold so they're treated as relevant context.
  return entries
    .slice(-limit)
    .reverse()
    .map((e) => ({ ...e, score: 0.9 }));
}

export async function getUserMemories(
  userId: string,
): Promise<MemoryEntry[]> {
  const entries = store.get(userId) || [];
  return entries.slice().reverse();
}

export async function clearUserMemory(userId: string): Promise<void> {
  store.delete(userId);
  logger.info({ userId }, "User memory cleared");
}

export async function checkHealth(): Promise<string> {
  return "connected";
}
