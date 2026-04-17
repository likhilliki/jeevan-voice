import { logger } from "../lib/logger.js";
import {
  detectIntent,
  detectLanguage,
  isEmergencySituation,
  getEmergencyResponse,
  type Intent,
  type Language,
} from "./intentDetector.js";
import { createEmbedding, generateResponse } from "./openai.js";
import {
  upsertMemory,
  searchMemory,
} from "./qdrant.js";

export interface AgentResult {
  response: string;
  intent: Intent;
  isEmergency: boolean;
  language: Language;
  userId: string;
  memoryUsed: boolean;
}

export async function processQuery(
  text: string,
  userId: string,
  preferredLanguage?: string,
): Promise<AgentResult> {
  // Step 1: Detect intent and language
  const intent = detectIntent(text);
  const detectedLanguage = detectLanguage(text);
  const language: Language =
    (preferredLanguage as Language) || detectedLanguage;
  const isEmergency = isEmergencySituation(intent);

  logger.info({ userId, intent, language, isEmergency }, "Processing query");

  // Step 2: Handle emergency immediately without waiting for memory
  if (isEmergency) {
    const emergencyResponse = getEmergencyResponse(language);

    // Store the emergency query in memory asynchronously (don't block response)
    storeMemoryAsync(userId, text, language, "emergency").catch((err) => {
      logger.error({ err }, "Failed to store emergency memory");
    });

    return {
      response: emergencyResponse,
      intent: "emergency",
      isEmergency: true,
      language,
      userId,
      memoryUsed: false,
    };
  }

  // Step 3: Create embedding for the query
  let queryEmbedding: number[] = [];
  let memoryContext = "";
  let memoryUsed = false;

  try {
    queryEmbedding = await createEmbedding(text);

    // Step 4: Search for relevant past conversations
    const memories = await searchMemory(userId, queryEmbedding, 3);

    if (memories.length > 0) {
      // Build context from top relevant memories
      memoryContext = memories
        .filter((m) => m.score > 0.5) // Only use moderately relevant memories
        .map((m) => m.text)
        .join(". ");
      memoryUsed = memoryContext.length > 0;
    }
  } catch (err) {
    // Memory lookup failed — still answer but without context
    logger.warn({ err }, "Memory lookup failed, continuing without context");
  }

  // Step 5: Generate AI response
  const response = await generateResponse(
    text,
    memoryContext,
    intent,
    language,
    false,
  );

  // Step 6: Store this interaction in memory (async, don't block)
  if (queryEmbedding.length > 0) {
    storeMemoryWithEmbeddingAsync(userId, text, queryEmbedding, {
      language,
      intent,
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      logger.error({ err }, "Failed to store memory");
    });
  } else {
    storeMemoryAsync(userId, text, language, intent).catch((err) => {
      logger.error({ err }, "Failed to store memory async");
    });
  }

  return {
    response,
    intent,
    isEmergency: false,
    language,
    userId,
    memoryUsed,
  };
}

async function storeMemoryAsync(
  userId: string,
  text: string,
  language: Language,
  intent: Intent,
): Promise<void> {
  try {
    const embedding = await createEmbedding(text);
    await upsertMemory(userId, text, embedding, {
      language,
      intent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "storeMemoryAsync failed");
  }
}

async function storeMemoryWithEmbeddingAsync(
  userId: string,
  text: string,
  embedding: number[],
  metadata: { language: Language; intent: Intent; timestamp: string },
): Promise<void> {
  await upsertMemory(userId, text, embedding, metadata);
}
