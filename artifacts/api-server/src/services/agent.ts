import { logger } from "../lib/logger.js";
import {
  detectIntent,
  detectLanguage,
  isEmergencySituation,
  getEmergencyResponse,
  type Intent,
  type Language,
} from "./intentDetector.js";
import {
  createEmbedding,
  generateResponse,
  type ActionItem,
} from "./openai.js";
import { upsertMemory, searchMemory } from "./qdrant.js";

export interface AgentResult {
  response: string;
  intent: Intent;
  isEmergency: boolean;
  language: Language;
  userId: string;
  memoryUsed: boolean;
  actions: ActionItem[];
}

function getEmergencyActions(language: Language): ActionItem[] {
  const labels: Record<string, { call: string; map: string }> = {
    hi: { call: "108 पर कॉल करें", map: "पास का अस्पताल" },
    kn: { call: "108 ಕರೆ ಮಾಡಿ", map: "ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ" },
    en: { call: "Call 108 Ambulance", map: "Nearest hospital" },
    auto: { call: "Call 108 Ambulance", map: "Nearest hospital" },
  };
  const l = labels[language] || labels.en;
  return [
    { type: "call", label: l.call, phone: "108" },
    { type: "map", label: l.map, query: "government hospital near me" },
  ];
}

export async function processQuery(
  text: string,
  userId: string,
  preferredLanguage?: string,
): Promise<AgentResult> {
  const intent = detectIntent(text);
  const detectedLanguage = detectLanguage(text);
  const language: Language =
    (preferredLanguage as Language) || detectedLanguage;
  const isEmergency = isEmergencySituation(intent);

  logger.info({ userId, intent, language, isEmergency }, "Processing query");

  if (isEmergency) {
    const emergencyResponse = getEmergencyResponse(language);

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
      actions: getEmergencyActions(language),
    };
  }

  let queryEmbedding: number[] = [];
  let memoryContext = "";
  let memoryUsed = false;

  try {
    queryEmbedding = await createEmbedding(text);
    const memories = await searchMemory(userId, queryEmbedding, 3);

    if (memories.length > 0) {
      memoryContext = memories
        .filter((m) => m.score > 0.5)
        .map((m) => m.text)
        .join(". ");
      memoryUsed = memoryContext.length > 0;
    }
  } catch (err) {
    logger.warn({ err }, "Memory lookup failed, continuing without context");
  }

  const aiResponse = await generateResponse(
    text,
    memoryContext,
    intent,
    language,
    false,
  );

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
    response: aiResponse.reply,
    intent,
    isEmergency: false,
    language,
    userId,
    memoryUsed,
    actions: aiResponse.actions || [],
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
